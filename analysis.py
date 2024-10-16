from concurrent.futures import ALL_COMPLETED
import imp
from itertools import repeat
import math
import numpy as np
from sklearn.neighbors import KDTree
import h5py
from scipy import ndimage as ndi
from skimage.measure import regionprops
import scipy.spatial as sptl
import scipy.sparse as sprs
import warnings
import multiprocessing as mp
from scipy.stats import wasserstein_distance
from scipy.interpolate import interp1d
from scipy.spatial.distance import squareform
from scipy.cluster.hierarchy import linkage, leaves_list
from sklearn.cluster import DBSCAN


def get_shape_coords(v1, v2, radius, dims, shape):
    cVolume = np.ones(dims)
    vec = v2 - v1
    bounding_box_min = np.maximum(np.minimum(v1, v2) - radius, 0).astype(int)
    bounding_box_max = np.minimum(np.maximum(v1, v2) + radius, np.array(dims)).astype(int)
    dist = np.linalg.norm(vec)
    if shape == 'cylinder':
        cVolume = np.zeros(dims)
        unit_vec = vec / dist
        for z in range(bounding_box_min[0], bounding_box_max[0]):
            for y in range(bounding_box_min[1], bounding_box_max[1]):
                for x in range(bounding_box_min[2], bounding_box_max[2]):
                    voxel = np.array([z, y, x])
                    voxel_vec = voxel - v1
                    projection = np.dot(unit_vec, voxel_vec)
                    if 0 <= projection <= dist:
                        perpendicular_dist = np.linalg.norm(voxel_vec - unit_vec * projection)
                        if perpendicular_dist <= radius:
                            cVolume[z, y, x] = 1
    else:
        dist_mid = dist * 0.5
        mid = v1 + vec * 0.5
        max_angle = np.arctan(radius / dist_mid)

        boundry = dist_mid
        if radius > dist_mid:
            boundry = radius

        boundry += 1

        z_min = int(max(mid[0] - boundry, 0))
        z_max = int(min(mid[0] + boundry, cVolume.shape[0]))

        y_min = int(max(mid[1] - boundry, 0))
        y_max = int(min(mid[1] + boundry, cVolume.shape[1]))

        x_min = int(max(mid[2] - boundry, 0))
        x_max = int(min(mid[2] + boundry, cVolume.shape[2]))

        mask = np.zeros(cVolume.shape)
        mask[z_min:z_max, y_min:y_max, x_min:x_max] = 1
        cVolume[mask == 0] = 0

        for voxel in np.array(np.nonzero(cVolume)).T:

            if np.linalg.norm(voxel - v2) == 0 or np.linalg.norm(voxel - v1) == 0:
                continue

            voxel_vec = voxel - v1

            projection = np.dot((v2 - v1) / np.linalg.norm(v2 - v1), voxel_vec)

            angle1 = np.arccos(np.clip(projection / np.linalg.norm(voxel_vec), -1, 1))

            angle2 = np.arccos(np.clip((np.linalg.norm(v2 - v1) - projection) / np.linalg.norm(voxel - v2), -1, 1))

            if angle1 > max_angle or angle2 > max_angle:
                cVolume[voxel[0], voxel[1], voxel[2]] = 0

    return cVolume


def edge_intensities(volume_path, channels, id, radius, thresholds, shape, save=False):
    channels = list(channels.split(','))
    result = {}
    found = False
    with h5py.File(volume_path, 'r') as f:
        try:
            if 'intensities' in f.keys():
                if id in f['intensities'].keys():
                    if str(radius) in f['intensities'][id].keys():
                        voxel_to_edge = f['intensities'][id][str(radius)][:]
                        found = True
        except:
            print('Error')
            print("id: {}, radius: {}, channels: {}, thresholds: {}, shape: {}".format(id, radius, channels, thresholds,
                                                                                       shape))

        if not found:
            dims = f['image'][list(f['image'].keys())[0]].shape
            edge_verteces = f['edges'][int(id) - 1]
            v1 = f['vertices'][int(edge_verteces[0])]
            v2 = f['vertices'][int(edge_verteces[1])]

            cVolume = get_shape_coords(v1, v2, radius, dims, shape)

            edge_coords = np.linspace(v1, v2, int(np.linalg.norm(v2 - v1)))
            tree = KDTree(edge_coords, metric='euclidean')

            voxel_to_edge = np.ones((len(edge_coords), radius * radius * 10, 3)) * -1

            for voxel in np.array(np.nonzero(cVolume)).T:
                i = tree.query(voxel.reshape(1, -1), k=1, return_distance=False)[0][0]
                j = 0
                while voxel_to_edge[i][j].sum() > 0:
                    j += 1
                voxel_to_edge[i][j] = voxel

    thresholds = [float(t) for t in thresholds.split(',')]

    for idx, channel in enumerate(channels):
        result[channel] = get_edge_intensity_worker(volume_path, channel, voxel_to_edge, thresholds, idx)[1]

    if save:
        with h5py.File(volume_path, 'a') as f:
            if 'intensities' not in f.keys():
                f.create_group('intensities')
            if id not in f['intensities'].keys():
                f['intensities'].create_group(id)
            if str(radius) not in f['intensities'][id].keys():
                f['intensities'][id].create_dataset(str(radius), data=voxel_to_edge)

    result = {f'{k} ': v for k, v in result.items()}
    return {id: result}


def get_edge_intensity_worker(volume_path, channel, voxel_to_edge, thresholds, idx):
    with h5py.File(volume_path, 'r') as h5f_cube:
        result = []
        intensity_volume = h5f_cube['image'][channel][:]
        intensity_volume = np.where(intensity_volume > thresholds[idx], intensity_volume, 0)
        print(voxel_to_edge.shape[0])
        for i in range(voxel_to_edge.shape[0]):
            edge_point = voxel_to_edge[i]
            result.append(0)
            voxels = [v for v in edge_point if v.sum() > 0]
            for voxel in voxels:
                x = int(voxel[0])
                y = int(voxel[1])
                z = int(voxel[2])
                result[i] += intensity_volume[x, y, z]

    result = np.array(result)
    if np.max(result) > 0:
        result = np.array(result, np.float32) / np.array(np.max(result), np.float32)
    result = result.tolist()
    return channel, result


def all_edge_intensities(volumePath, channels, radius, thresholds, shape, save=False):
    with h5py.File(volumePath, 'r') as f:
        if 'edges' not in f.keys():
            return "No edges found!", 200
        l_edges = len(f['edges'])

    result = {}
    for i in range(l_edges):
        result.update(edge_intensities(volumePath, channels, str(i + 1), radius, thresholds, shape, save))

    return result


def calculate_centers(channel):
    if np.unique(channel).shape[0] <= 2:
        channel, _ = ndi.label(channel)
    regions = regionprops(channel)
    centers = [region.centroid for region in regions]
    return np.array(centers, dtype=int)


def get_delaunay_edges(points):
    tri = sptl.Delaunay(points)
    lil = sprs.lil_matrix((tri.npoints, tri.npoints))

    indices, indptr = tri.vertex_neighbor_vertices
    for k in range(tri.npoints):
        lil.rows[k] = indptr[indices[k]:indices[k + 1]].tolist()
        lil.data[k] = np.ones_like(lil.rows[k]).tolist()

    coo = lil.tocoo()
    conns = np.vstack((coo.row, coo.col)).T
    delaunay_conns = np.sort(conns, axis=1)
    return delaunay_conns, tri


def get_gabriel_graph(tri, delaunay_conns, points, min_dist=10):
    c = tri.points[delaunay_conns]
    m = (c[:, 0, :] + c[:, 1, :]) / 2
    r = np.sqrt(np.sum((c[:, 0, :] - c[:, 1, :]) ** 2, axis=1)) / 2
    tree = sptl.KDTree(points)
    n = tree.query(x=m, k=1)[0]
    g = n >= r * (0.999)
    gabriel_conns = delaunay_conns[g]
    edges = []
    for edge in gabriel_conns:
        found = False
        for controll in edges:
            if controll[0] == edge[0] and controll[1] == edge[1]:
                found = True
                break
        if not found:
            edges.append(edge)
    return np.array(edges)


def get_voxels_within_radius(center, radius, shape):
    arr = np.zeros(shape)

    # create a meshgrid of indices
    z, y, x = np.meshgrid(np.arange(arr.shape[0]), np.arange(arr.shape[1]), np.arange(arr.shape[2]), indexing='ij')
    indices = np.stack([z, y, x], axis=-1)

    # calculate the Euclidean distance between each voxel and the center
    distances = np.linalg.norm(indices - center, axis=-1)

    # get the boolean array indicating which voxels are within the radius from the center
    within_radius = distances <= radius

    # get the indices of the voxels that are within the radius from the center
    indices_within_radius = indices[within_radius]

    return indices_within_radius


def calculate_angles(voxels, center):
    # subtract the center from the voxels and ignore the first dimension
    vecs = voxels[:, 1:] - center[1:]
    # calculate the angles using arctan2
    angles = np.arctan2(vecs[:, 0], vecs[:, 1])

    # Calculate the percentage
    angles_percent = ((angles / (2 * np.pi)) + 0.5) * 100

    return angles_percent


def get_polarizations(volumePath, edge_ids, channel, radius, threshold):
    centers = []
    final_centers = []
    arc_data = []
    with h5py.File(volumePath, 'r') as f:
        for id in edge_ids:
            centers.append(f['edges'][id - 1][0][()])
            centers.append(f['edges'][id - 1][1][()])
        centers = np.unique(centers)
        for node_id in centers:
            found = False
            angles = []
            node_id = str(node_id)
            if 'polarization' in f.keys():
                if node_id in f['polarization'].keys():
                    if str(radius) in f['polarization'][node_id].keys():
                        angles = f['polarization'][node_id][str(radius)][:]
                        found = True

            center = f['vertices'][int(node_id)][:]
            cube = f['image'][channel][:]
            cube = np.where(cube > threshold, 1, 0)
            regions = np.zeros((12,))
            if not found:
                voxels = get_voxels_within_radius(center, radius, cube.shape)
                angles = calculate_angles(voxels, center)

            counters = np.zeros(12)
            for a in range(0, 12, 1):
                for j, angle in enumerate(angles):
                    if (a * 8.3) <= angle < (a * 8.3) + 8.3:
                        regions[a] += cube[voxels[j][0], voxels[j][1], voxels[j][2]]

            #possible_volume = ((4/3) * math.pi * (radius ** 3))/24
            
            max = np.max(regions)
            max = max if max > 0 else 1
            regions = [math.ceil((a/max) * 10) / 10 for a in regions]


            #regions = [min(a, 1) for a in regions]

            corrected_center = [int(center[2] - cube.shape[2] * 0.5), int(center[1] - cube.shape[1] * 0.5),
                                int(center[0] - cube.shape[0] * 0.5)]
            final_centers.append(corrected_center)
            arc_data.append(regions)

    arc_data = [a for a in arc_data]
    centers = [str(center) for center in centers]
    return [final_centers, arc_data, centers]


def get_edge_intensities_rank(volume_path, channels, id, radius, thresholds, shape, save=False, edges=None):
    primary_edge = edge_intensities(volume_path, channels, str(id), radius, thresholds, shape, save=save)
    if edges is None:
        with h5py.File(volume_path, 'r') as f:
            edges = [i + 1 for i in range(len(f['edges']))]
    else:
        edges = [int(i) for i in edges.split(',')]

    intensities = {}
    for i in edges:
        result = edge_intensities(volume_path, channels, str(i), radius, thresholds, shape, save=save)
        intensities.update(result)

    fc = list(intensities[str(id)].keys())[0]
    target_length = len(intensities[str(id)][fc])

    for edge_id in intensities.keys():
        edge_dist = 0
        for channel in intensities[edge_id].keys():
            target = primary_edge[str(id)][channel] #First get the target channel value
            val = intensities[str(edge_id)][channel] #Then get the other channel value
            f = interp1d(np.arange(len(val)), val, kind='linear', fill_value="extrapolate")
            val_normalized = f(np.linspace(0, len(val) - 1, target_length))

            dist = wasserstein_distance(target, val_normalized) #calculate the distance between them
            primary_edge[str(id)][channel].reverse() #First get the target channel value

            val = intensities[str(edge_id)][channel] #Then get the other channel value
            f = interp1d(np.arange(len(val)), val, kind='linear', fill_value="extrapolate")
            val_normalized = f(np.linspace(0, len(val) - 1, target_length))

            dist2 = wasserstein_distance(target, val_normalized) #calculate the distance between them
            edge_dist += min(dist, dist2) #add the distance to the overall edge distance
        intensities[str(edge_id)]['dist'] = edge_dist

    sorted_intensities = sorted(intensities.items(), key=lambda x: x[1]['dist'])
    print([(x[0], x[1]['dist']) for x in sorted_intensities])

    sorted_intensities = [x[0] for x in sorted_intensities]
    return sorted_intensities


def precompute_edge_intensities(volume_path, id, radii, shape):
    to_remove_radii = []
    with h5py.File(volume_path, 'r') as f:
        if 'intensities' in f.keys():
            if id in f['intensities'].keys():
                for radius in radii:
                    if str(radius) in f['intensities'][id].keys():
                        to_remove_radii.append(radius)

    radii = [x for x in radii if x not in to_remove_radii]

    with mp.Pool(processes=mp.cpu_count()) as pool:
        result = pool.starmap(precompute_edge_intensity, zip(repeat(volume_path), repeat(id), radii, repeat(shape)))

    with h5py.File(volume_path, 'a') as f:
        if 'intensities' not in f.keys():
            f.create_group('intensities')
        if id not in f['intensities'].keys():
            f['intensities'].create_group(id)
        for i in range(len(result)):
            radius = str(result[i][0])
            values = result[i][1]
            if radius not in f['intensities'][id].keys():
                f['intensities'][id].create_dataset(radius, data=values)

    return


def precompute_edge_intensity(volume_path, id, radius, shape):
    with h5py.File(volume_path, 'r') as f:
        dims = f['image'][list(f['image'].keys())[0]].shape
        edge_verteces = f['edges'][int(id) - 1]
        v1 = f['vertices'][int(edge_verteces[0])]
        v2 = f['vertices'][int(edge_verteces[1])]

        cVolume = get_shape_coords(v1, v2, radius, dims, shape)

        edge_coords = np.linspace(v1, v2, int(np.linalg.norm(v2 - v1)))
        tree = KDTree(edge_coords, metric='euclidean')

        voxel_to_edge = np.ones((len(edge_coords), (radius * radius) * 10, 3)) * -1

        for voxel in np.array(np.nonzero(cVolume)).T:
            i = tree.query(voxel.reshape(1, -1), k=1, return_distance=False)[0][0]
            j = 0
            try:
                while voxel_to_edge[i][j][0] >= 0:
                    j += 1
                voxel_to_edge[i][j] = voxel
            except:
                print(voxel_to_edge.shape)
                print(i, j)
                print(voxel_to_edge[i][j - 1])
    return radius, voxel_to_edge


def precompute_polarizations(volume_path, node_id, radii):
    r_angles = []
    c_radii = []
    with h5py.File(volume_path, 'r') as f:
        if 'polarization' in f.keys():
            if str(node_id) in f['polarization'].keys():
                for radius in radii:
                    if str(radius) not in f['polarization'][str(node_id)].keys():
                        c_radii.append(radius)

        cube = f['image'][list(f['image'].keys())[0]][:]
        center = f['vertices'][node_id][:]

    for radius in c_radii:
        voxels = get_voxels_within_radius(center, radius, cube.shape)
        angles = calculate_angles(voxels, center)
        r_angles.append(angles)

    with h5py.File(volume_path, 'a') as f:
        if 'polarization' not in f.keys():
            f.create_group('polarization')
            if node_id not in f['polarization'].keys():
                f.create_group('polarization/' + node_id)
                for radius, angles in zip(c_radii, r_angles):
                    if str(radius) not in f['polarization'][node_id].keys():
                        f['polarization'][node_id].create_dataset(str(radius), data=angles)

    return


def get_edge_channels_rank(volume_path, channels, id, radius, thresholds, shape, save=False):
    primary_edge = edge_intensities(volume_path, channels, str(id), radius, thresholds, shape, save=save)[id]

    # Calculate pairwise Wasserstein distances
    channel_names = list(primary_edge.keys())
    channel_arrays = [primary_edge[name] for name in channel_names]

    dist_matrix = np.zeros((len(channel_arrays), len(channel_arrays)))
    for i in range(len(channel_arrays)):
        for j in range(i + 1, len(channel_arrays)):
            dist_matrix[i, j] = wasserstein_distance(channel_arrays[i], channel_arrays[j])
            dist_matrix[j, i] = dist_matrix[i, j]

    # Convert the distance matrix to a condensed distance matrix (1D)
    condensed_dist_matrix = squareform(dist_matrix)

    # Apply hierarchical clustering
    Z = linkage(condensed_dist_matrix, method="average")
    sorted_indices = leaves_list(Z)

    # Extract sorted channel names
    sorted_channels = [channel_names[i] for i in sorted_indices]
    return sorted_channels


def get_edge_channels_clusters(volume_path, channels, id, radius, thresholds, shape, cluster_threshold, save=False):
    primary_edge = edge_intensities(volume_path, channels, str(id), radius, thresholds, shape, save=save)[id]

    # Extract channel names and their respective intensity arrays
    channel_names = list(primary_edge.keys())
    channel_arrays = [primary_edge[name] for name in channel_names]

    # Calculate pairwise Wasserstein distances
    dist_matrix = np.zeros((len(channel_arrays), len(channel_arrays)))
    for i in range(len(channel_arrays)):
        for j in range(i + 1, len(channel_arrays)):
            dist_matrix[i, j] = wasserstein_distance(channel_arrays[i], channel_arrays[j])
            dist_matrix[j, i] = dist_matrix[i, j]

    # DBSCAN requires a 1D array of distances, but it uses Euclidean distances by default.
    # Instead, we precompute a distance matrix and then use DBSCAN with a precomputed metric.
    db = DBSCAN(eps=cluster_threshold, min_samples=1, metric="precomputed")
    
    # DBSCAN expects a distance matrix, but we need to convert our distance matrix to fit the expected format
    # Since we're using 'precomputed', we can directly feed the distance matrix after ensuring it's in the right shape
    db.fit(dist_matrix)

    # Labels for each channel
    labels = db.labels_

    # Organize channels into clusters based on DBSCAN labels
    clusters = {}
    for label in set(labels):
        clusters[str(label)] = [channel_names[i] for i, lab in enumerate(labels) if lab == label]

    return clusters

