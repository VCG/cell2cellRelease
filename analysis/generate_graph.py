from turtle import distance
import numpy as np
import h5py
import tifffile
import scipy.spatial as sptl
import scipy.sparse as sprs
from skimage.measure import regionprops
from skimage.draw import line_nd
from skimage.morphology import ball, diamond
import skimage.filters
from tqdm import tqdm
import nrrd
import sys
from sklearn.neighbors import KDTree

marker_names = ["DNA1","PD1","TLR3","SOX10","DNA2","CD163",
"CD3D","PDL1","DNA3","CD4","ICOS","HLADPB1","DNA4","CD8A",
"CD68","GZMB","DNA5","CD40L","LAG3","HLAA","DNA6","SQSTM",
"VIN","TIM3","DNA7","LAMP1_CD107A","PDL1_2","PD1_2", "DNA_masks", 
"HLAA_masks", "DNA_binary_masks", "HLAA_binary_masks"]

markers_for_calc = ["SOX10","CD163",
"CD3D","PDL1","CD4","ICOS","HLADPB1","CD8A",
"CD68","GZMB","LAG3","HLAA","DNA6",
"VIN","TIM3","PD1_2"]


def merge_close_regions(channel, min_dist):
    print("merge close regions")
    regions = regionprops(channel)
    centers = [region.centroid for region in regions]
    tree = KDTree(centers)
    neighbors = tree.query_radius(centers, r=min_dist)
    for neighbor in neighbors:
        if len(neighbor) > 1:
            for n in neighbor:
                channel[channel == n] = neighbor[0]

    return channel

def generate_cube(filename):
    print("Generating cube")
    img = tifffile.imread(filename)
    img = np.moveaxis(img, 0, 1)
    with h5py.File("data/cube.h5", "w") as cube:
        for i, c in tqdm(enumerate(marker_names), total=len(marker_names)):
            new_img = np.array(img[i], dtype=np.float32)
            new_img /= np.max(new_img)
            if c not in ["DNA_masks", "HLAA_masks", "DNA_binary_masks", "HLAA_binary_masks"]:
                pass
                #new_img = skimage.filters.gaussian(new_img)
            cube.create_dataset('image/{}'.format(c), data=new_img)

def load_channel(channel_name=None):
    with h5py.File("data/cube.h5", "r") as cubef:
        if channel_name != None:
            return np.array(cubef['image'][channel_name])
        return cubef

def load_cube(channel_names):
    with h5py.File("data/cube.h5", "r") as cubef:
        cube = [np.array(cubef[c]) for c in channel_names]
        cube = np.stack(cube)
        return cube

def get_nuclei_centers(channel, alter=False):
    if alter:
        from scipy import ndimage as ndi
        with h5py.File('data/centers.h5', 'r') as hf:
            centers = hf['exported_data'][:].squeeze()
            channel, _ = ndi.label(centers)
    regions = regionprops(channel)
    centers = [region.centroid for region in regions]
    return np.array(centers, dtype=int)

def get_delaunay_edges(points):
    tri = sptl.Delaunay(points)
    lil = sprs.lil_matrix((tri.npoints, tri.npoints))

    indices, indptr = tri.vertex_neighbor_vertices
    for k in range(tri.npoints):
        lil.rows[k] = indptr[indices[k]:indices[k+1]].tolist()
        lil.data[k] = np.ones_like(lil.rows[k]).tolist()

    coo = lil.tocoo()
    conns = np.vstack((coo.row, coo.col)).T
    delaunay_conns = np.sort(conns, axis=1)
    return delaunay_conns, tri

def get_gabriel_graph(tri, delaunay_conns, min_dist=10):
    c = tri.points[delaunay_conns]
    m = (c[:, 0, :] + c[:, 1, :])/2
    r = np.sqrt(np.sum((c[:, 0, :] - c[:, 1, :])**2, axis=1))/2
    tree = sptl.KDTree(points)
    n = tree.query(x=m, k=1)[0]
    g = n >= r*(0.999)
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

def generate_visual_edges(gabriel_conns, shape, radius):
    print("Generating cones from edges")
    visual_graph = np.zeros(shape, dtype=np.uint16)
    for i, gabriel_con in tqdm(enumerate(gabriel_conns), total=len(gabriel_conns)):
        i += 1
        start = points[gabriel_con[0]]
        end = points[gabriel_con[1]]
        edge = line_nd(start, end, integer=True)
        edge = np.transpose(edge)
        for d, point in enumerate(edge):
            visual_graph[point[0], point[1], point[2]] = i
            cone_radius = 1
            if d < int(len(edge)/2):
                cone_radius += (d/len(edge))*radius*2
            else:
                cone_radius += (radius-(d/len(edge))*radius)*2
            cone_radius = int(cone_radius)
            new_points = thicken_line(point, cone_radius)
            for new_point in new_points:
                if new_point[0] < shape[0] and new_point[1] < shape[1] and new_point[2] < shape[2]:
                    visual_graph[new_point[0], new_point[1], new_point[2]] = i
    visual_graph = np.expand_dims(visual_graph, 0)
    return visual_graph

def thicken_line(point, radius):
    point = np.array(point)
    sphere = np.transpose(np.nonzero(ball(radius)))
    for coord in sphere:
        for dim in range(len(point)):
            coord[dim] += (point[dim]-radius)
    sphere = np.where(sphere > 0, sphere, 0)
    return sphere

def save_graph(vertices, edges, radius, filename):
    with h5py.File(filename, "a") as f:
        f.create_dataset("vertices", data=vertices)
        f.create_dataset("edges", data=edges)
        f.create_dataset("radius", data=radius)

def generate_nrrds(channels):
    print("Generating nrrds")
    for channel_name in tqdm(channels):
        marker = load_channel(channel_name)
        marker = np.array(marker, dtype=np.float32)
        marker = np.moveaxis(marker, 0, -1)
        marker = np.moveaxis(marker, 0, 1)
        marker /= np.max(marker)
        marker *= 255
        marker = marker.astype(np.uint8)
        nrrd.write("data/nrrd/{}.nrrd".format(channel_name), marker)

def meassure_markers(marker_names, edge_channel, points, edges, threshold, step_size=1):
    print("Meassuring markers")
    edge_channel = np.squeeze(edge_channel)
    with h5py.File("data/graph.h5", "a") as graphf:
        graphf.create_dataset("marker_name_edge_density", data=marker_names)
        density_group = graphf.create_group("edge_density")
        for i, edge in tqdm(enumerate(edges), total=len(edges)):
            i += 1
            start = points[edge[0]]
            end = points[edge[1]]
            line_coords = np.array(line_nd(start, end, integer=False)).transpose()
            edge_coords = np.transpose(np.where(edge_channel == i))
            edge_densities = np.zeros((len(marker_names), line_coords.shape[0]))

            tree = KDTree(line_coords, metric="euclidean")
            neighbors = tree.query(edge_coords, k=1)[1]
            edge_group = density_group.create_group(str(i))
            for j, marker_name in enumerate(marker_names):
                marker = load_channel(marker_name)
                marker = np.array(marker, dtype=np.float32)
                marker /= np.max(marker)
                marker = np.where(marker > threshold, marker, 0)
                non_zeroes = len(np.nonzero(marker)[0])
                for k, neighbor in enumerate(neighbors):
                    edge_densities[j, neighbor[0]] += (marker[edge_coords[k, 0], edge_coords[k, 1], edge_coords[k, 2]]/non_zeroes)
                edge_group.create_dataset(marker_name, data=edge_densities[j])
    return


cube_num = sys.argv[1]
edge_radius = int(sys.argv[2])
merge_distance = int(sys.argv[3])
threshold = float(sys.argv[4])

save_graph_image = True

filename = 'data/raw/{}_R3D_D3D_3D_MERGED.tiff'.format(cube_num)
generate_cube(filename)
dna_masks = load_channel("DNA_masks")
#dna_masks = merge_close_regions(dna_masks, merge_distance)
points = get_nuclei_centers(dna_masks, alter=True)
delaunay_conns, tri = get_delaunay_edges(points)
gabriel_conns = get_gabriel_graph(tri, delaunay_conns)
save_graph(points, gabriel_conns, edge_radius, "data/cube.h5")
#generate_nrrds(marker_names)
#edge_channel = generate_visual_edges(gabriel_conns, dna_masks.shape, edge_radius)
#meassure_markers(marker_names, edge_channel, points, gabriel_conns, threshold, step_size=1)

exit()
if save_graph_image:
    cube = load_cube(marker_names)
    cube = np.append(cube, edge_channel, axis=0)
    cube = np.moveaxis(cube, 0, 1)
    cube *= np.iinfo(np.uint16).max
    cube = np.array(cube, dtype=np.uint16)
    tifffile.imwrite('data/raw/{}_graph.tiff'.format(cube_num), cube, imagej=True)
