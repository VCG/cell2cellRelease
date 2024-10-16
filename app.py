from io import StringIO, BytesIO
import os
from flask import Flask, jsonify, request, session, render_template, Response, send_file
import h5py
import numpy as np
import tifffile
from sklearn.neighbors import KDTree
from tqdm import trange
from skimage.io import imsave
from PIL import Image
import base64
from skimage.color import gray2rgb
from skimage.morphology import disk
import multiprocessing as mp

from analysis import all_edge_intensities, calculate_centers, edge_intensities, get_delaunay_edges, get_edge_channels_rank, get_gabriel_graph, get_polarizations, get_edge_intensities_rank, precompute_edge_intensities, precompute_polarizations, get_edge_channels_clusters

app = Flask(__name__)
app.config.update(
    TESTING=True,
    DEBUG=True,
    FLASK_ENV='development',
    SECRET_KEY=os.urandom(12),
)

@app.route("/", methods=['GET'])
def index():
    return render_template('index.html'), 200

@app.route("/", methods=['POST'])
def viewer():
    volume_path = request.form['volumePath']
    
    if not os.path.exists(volume_path):
        return 'Invalid volume path', 400
    
    if not volume_path.endswith('.h5'):
        img = tifffile.imread(volume_path)
        img = np.moveaxis(img, 0, 1)
        h5_path = volume_path.split('.')[0] + '.h5'
        with h5py.File(h5_path, "w") as cube:
            for i in range(img.shape[0]):
                new_img = np.array(img[i], dtype=np.float32)
                new_img /= np.max(new_img)
                cube.create_dataset('image/{}'.format(i), data=new_img)
            cube.create_dataset('edges', chunks=True, maxshape=(None, 2))
            cube.create_dataset('vertices', chunks=True, maxshape=(None, 3))
        session['volumePath'] = h5_path
    else:
        session['volumePath'] = request.form['volumePath']
    '''
    if request.form['maskChannel']:
        mask_channel = request.form['maskChannel']
        with h5py.File(session['volumePath'], "a") as cube:
            image = cube['image']
            centers = calculate_centers(image[mask_channel][:])
            delaunay_conns, tri = get_delaunay_edges(centers)
            gabriel_conns = get_gabriel_graph(tri, delaunay_conns, centers)
            cube.create_dataset("vertices", data=centers)
            cube.create_dataset("edges", data=gabriel_conns)
            cube.create_dataset("radius", data=10)
    '''
    return render_template('viewer.html'), 200

@app.route("/vertices", methods=['GET'])
def get_vertices():
    result = []
    with h5py.File( session['volumePath'], 'r') as f:
        dims = f['image'][list(f['image'].keys())[0]].shape
    with h5py.File( session['volumePath'], 'r') as f:
        if not 'vertices' in f.keys():
            return jsonify(result)
        for i, vertex in enumerate(f['vertices']):
            cell_type = 0
            if 'cell_types' in f.keys():
                if len(f['cell_types']) > i:
                    cell_type = int(f['cell_types'][i])
            j_vertex = {'x': int(vertex[2]-dims[2]*0.5), 'y': int(vertex[1]-dims[1]*0.5), 'z': int(vertex[0]-dims[0]*0.5), 'id': str(i), 'cellType': cell_type}
            result.append(j_vertex)
    return jsonify(result), 200

@app.route("/edges", methods=['GET'])
def get_edges():
    result = []
    with h5py.File(session['volumePath'], 'r') as f:
        if not 'edges' in f.keys():
            return jsonify(result)
        for i, edge in enumerate(f['edges']):
            j_edge = {'start': int(edge[0]), 'end': int(edge[1]), 'id': str(i+1)}
            result.append(j_edge)
    return jsonify(result), 200

@app.route("/marker/<name>", methods=['GET'])
def marker(name):
    name = name.strip()
    result = None
    with h5py.File(session['volumePath'], 'r') as f:
        if name not in f.keys():
            return "Marker not found!", 404
        marker = f[name]
        
        marker = np.array(marker, dtype=np.float32)
        marker = marker[28:30, 500:, 500:]
        result = {'xLength':marker.shape[0], 'yLength':marker.shape[1], 'zLength':marker.shape[2]}
        marker /= np.max(marker)
        marker = np.reshape(marker, -1)
        result['data'] = marker.tolist()
    return jsonify(result), 200

@app.route("/channels", methods=['GET'])
def get_channel_names():
    results = {}
    with h5py.File(session['volumePath'], 'r') as f:
        for key in f['image'].keys():
            key = '{} '.format(key)
            results[key] = key
    return jsonify(results), 200

@app.route("/intensity", methods=['GET'])
def get_edge_intensities():
    id  = request.args.get('id', None)
    radius  = int(request.args.get('radius', None))
    channels = request.args.get('channels', None)
    thresholds = request.args.get('thresholds', None)
    shape = request.args.get('shape', None)
    pre = request.args.get('pre', None)
    
    channels = channels.replace(' ', '')

    session['id'] = id
    session['radius'] = radius
    session['channels'] = channels
    session['thresholds'] = thresholds
    session['shape'] = shape

    result = edge_intensities(session['volumePath'], channels, id, radius, thresholds, shape, save=False)
    
    return jsonify(result), 200

@app.route("/intensity/all", methods=['GET'])
def prepare_all_edge_intensities():
    radius  = int(request.args.get('radius', None))
    channels = request.args.get('channels', None)
    thresholds = request.args.get('thresholds', None)
    shape = request.args.get('shape', None)

    channels = channels.replace(' ', '')
    
    session['radius'] = radius
    session['channels'] = channels
    session['thresholds'] = thresholds
    session['shape'] = shape

    result = all_edge_intensities(session['volumePath'], channels, radius, thresholds, shape, save=False)

    return jsonify(result), 200

@app.route("/intensity/csv", methods=['GET'])
def get_edge_intensities_csv():
    id  = request.args.get('id', None)
    radius  = int(request.args.get('radius', None))
    channels = request.args.get('channels', None)
    thresholds = request.args.get('thresholds', None)
    shape = request.args.get('shape', None)
    
    channels = channels.replace(' ', '')

    result = edge_intensities(session['volumePath'], channels, id, radius, thresholds, shape, save=False)
    new_result = []
    for cn, cv in result[id].items():
        for i, v in enumerate(cv):
            new_result.append([id, cn[:-1], i, v])

    output = StringIO()
    np.savetxt(output, new_result, fmt="%s", header="id,channel,x,y", delimiter=",")
    csv_string = output.getvalue()
    return Response(
        csv_string,
        mimetype="text/csv",
        headers={"Content-disposition":
                 "attachment; filename=edge_{}.csv".format(id)}), 200

@app.route("/volume/<name>", methods=['GET'])
def get_volume(name):
    
    name = name.strip()
    result = {}
    with h5py.File(session['volumePath'], 'r') as f:
        if name == 'first':
            volume = f['image'][list(f['image'].keys())[0]]
        elif name not in f['image'].keys():
            return "Volume not found!", 404
        else:
            volume = f['image'][name]
        volume = np.array(volume, dtype=np.float32)
        result = {'xLength':volume.shape[2], 'yLength':volume.shape[1], 'zLength':volume.shape[0]}
        volume *= 255
        volume = np.reshape(volume, -1)
        volume = np.array(volume, dtype=np.uint8)
        result['data'] = volume.tolist()

    return jsonify(result), 200

@app.route("/slice/<dim>", methods=['GET'])
def getSlice(dim):
    x = int(request.args.get('x', None))
    y = int(request.args.get('y', None))
    z = int(request.args.get('z', None))  
    channel = request.args.get('channel', None)
    
    with h5py.File(session['volumePath'], 'r') as f:
        cube = f['image'][channel]
        
            
        x = cube.shape[1] - x + 250
        y += 250
        z = int(z + cube.shape[0]/2)+50
        
        cube = np.array(cube, dtype=np.float32)

        cube = np.pad(cube, ((50,50),(250,250),(250,250)), 'constant')
        
        x_min = x - 200
        x_max = x + 200
        y_min = y - 200
        y_max = y + 200
        z_min = int(z - cube.shape[0]/2)
        z_max = int(z + cube.shape[0]/2)
        
        if dim == 'xy':
            image = cube[z, x_min:x_max, y_min:y_max]
        elif dim == 'xz':
            image = cube[z_min:z_max, x_min:x_max, y]
        elif dim == 'yz':
            image = cube[z_min:z_max, x, y_min:y_max]
            
        img = image
        img /= np.max(img)
        img = np.array(img*255, dtype=np.uint8)
        
        img = gray2rgb(img)
        x, y = np.meshgrid(np.arange(img.shape[1]), np.arange(img.shape[0]))
        radius = 10
        distance = np.sqrt((x - img.shape[1]/2) ** 2 + (y - img.shape[0]/2) ** 2)
        img[distance < radius] = (255, 0, 0)
        img = Image.fromarray(img.astype("uint8"))
        rawBytes = BytesIO()
        img.save(rawBytes, "JPEG")
        rawBytes.seek(0)
        img_base64 = base64.b64encode(rawBytes.read())
        return jsonify({'status':str(img_base64)})
    
@app.route("/vertices", methods=['POST'])
def addNewCenters():
    
    '''
    
    request_data = request.get_json()
    newCenters = request_data[0]
    deleteCenters = request_data[1]
    newCenterIds = []
    with h5py.File(session['volumePath'], 'a') as f:
        dims = f['image'][list(f['image'].keys())[0]].shape
        vertices_ds = f['vertices']
        for i in newCenters:
            x = int(i[2]+dims[2]*0.5)
            y = int(i[1]+dims[1]*0.5)
            z = int(i[0]+dims[0]*2)
            vertices_ds.resize((vertices_ds.shape[0]+1, 3))
            newCenterIds.append(vertices_ds.shape[0]-1)
            vertices_ds[-1] = np.array([z, y, x])
            
        delaunay_conns, tri = get_delaunay_edges(vertices_ds)
        gabriel_conns = get_gabriel_graph(tri, delaunay_conns, vertices_ds)
        for ne in gabriel_conns:
            if ne[0] not in newCenterIds or ne[1] not in newCenterIds:
                continue
            f['edges'].resize((f['edges'].shape[0]+1, 2))
            f['edges'][-1] = np.array([ne[0], ne[1]])
        
            
    if len(deleteCenters) == 0:
        return jsonify({'status':'ok'}), 200
    
    with h5py.File(session['volumePath'], 'a') as f:
        for dc in deleteCenters:
            x = int(dc[2]+dims[2]*0.5)
            y = int(dc[1]+dims[1]*0.5)
            z = int(dc[0]+dims[0]*0.5)
            for i, oc in enumerate(vertices_ds):
                if oc[0] == z or oc[1] == y or oc[2] == x:
                    vertices_ds = np.delete(vertices_ds, i, 0)
                    break

        delaunay_conns, tri = get_delaunay_edges(vertices_ds)
        gabriel_conns = get_gabriel_graph(tri, delaunay_conns, vertices_ds)
        del f['edges']
        del f['vertices']
        
        f.create_dataset('edges', data=gabriel_conns, chunks=True, maxshape=(None, 2))
        f.create_dataset('vertices', data=vertices_ds, chunks=True, maxshape=(None, 3))
        
    return jsonify({'status':'ok'}), 200
    '''

    request_data = request.get_json()
    newCenters = request_data[0]
    deleteCenters = request_data[1]
    with h5py.File(session['volumePath'], 'a') as f:
        dims = f['image'][list(f['image'].keys())[0]].shape
        vertices_ds = f['vertices'][:]
        for i in newCenters:
            x = int(i[2]+dims[2]*0.5)
            y = int(i[1]+dims[1]*0.5)
            z = int(i[0]+dims[0]*2)
            vertices_ds = np.vstack((vertices_ds, np.array([z, y, x])))
        
        for dc in deleteCenters:
            x = int(dc[2]+dims[2]*0.5)
            y = int(dc[1]+dims[1]*0.5)
            z = int(dc[0]+dims[0]*0.5)
            for i, oc in enumerate(vertices_ds):
                if oc[0] == z or oc[1] == y or oc[2] == x:
                    vertices_ds = np.delete(vertices_ds, i, 0)
                    break

        delaunay_conns, tri = get_delaunay_edges(vertices_ds)
        gabriel_conns = get_gabriel_graph(tri, delaunay_conns, vertices_ds)
        del f['vertices']
        del f['edges']
        del f['intensities']
        f.create_dataset("vertices", data=vertices_ds)
        f.create_dataset("edges", data=gabriel_conns)
        f.create_group("intensities")
    return jsonify({'status':'ok'}), 200

@app.route("/polarization", methods=['GET'])
def get_polarization_for_id():
    radius  = int(request.args.get('radius', None))
    channel = request.args.get('channel', None)
    threshold = float(request.args.get('threshold', None))
    edge_ids = request.args.get('edge_ids', None)
    
    channel = channel.strip()
    edge_ids = [int(id) for id in edge_ids.split(',')]
    
    arcs = get_polarizations(session['volumePath'],edge_ids, channel, radius, threshold)
    return jsonify(arcs), 200

@app.route("/intensities/rank", methods=['GET'])
def get_intensities_rank():
    id  = request.args.get('id', None)
    radius  = int(request.args.get('radius', None))
    channels = request.args.get('channels', None)
    thresholds = request.args.get('thresholds', None)
    shape = request.args.get('shape', None)
    edges = request.args.get('edges', None)
    
    channels = channels.replace(' ', '')

    session['id'] = id
    session['radius'] = radius
    session['channels'] = channels
    session['thresholds'] = thresholds
    session['shape'] = shape
    
    result = get_edge_intensities_rank(session['volumePath'], channels, id, radius, thresholds, shape, save=False, edges=edges)
    
    return jsonify(result), 200
    
@app.route("/channels/rank", methods=['GET'])
def get_channels_rank():
    id  = request.args.get('id', None)
    radius  = int(request.args.get('radius', None))
    channels = request.args.get('channels', None)
    thresholds = request.args.get('thresholds', None)
    shape = request.args.get('shape', None)
    
    channels = channels.replace(' ', '')

    session['id'] = id
    session['radius'] = radius
    session['channels'] = channels
    session['thresholds'] = thresholds
    session['shape'] = shape
    
    result = get_edge_channels_rank(session['volumePath'], channels, id, radius, thresholds, shape, save=False)
    
    return jsonify(result), 200

@app.route("/channels/clusters", methods=['GET'])
def get_channels_clusters():
    id  = request.args.get('id', None)
    radius  = int(request.args.get('radius', None))
    channels = request.args.get('channels', None)
    thresholds = request.args.get('thresholds', None)
    shape = request.args.get('shape', None)
    cluster_threshold = float(request.args.get('cluster_threshold', None))
    
    channels = channels.replace(' ', '')

    session['id'] = id
    session['radius'] = radius
    session['channels'] = channels
    session['thresholds'] = thresholds
    session['shape'] = shape
    
    result = get_edge_channels_clusters(session['volumePath'], channels, id, radius, thresholds, shape, cluster_threshold, save=False)
    
    return jsonify(result), 200
    
@app.route('/volumePath', methods=['POST'])
def set_volume_path():
    request_data = request.get_json()
    if os.path.exists(request_data['volumePath']):
        session['volumePath'] = request_data['volumePath']
        return jsonify({'status':'ok'}), 200
    else:
        return jsonify({'status':'path not found'}), 500
    
@app.route('/precompute', methods=['DELETE'])
def delete_precomputation():
    with h5py.File(session['volumePath'], 'a') as f:
        if 'intensities' in f.keys():
            del f['intensities']
        if 'polarizations' in f.keys():
            del f['polarizations']
    return jsonify({'status':'ok'}), 200


@app.route('/precomputeIntensities', methods=['POST'])
def start_precomputation_intensities():
    
    request_data = request.get_json()
    
    id  = request_data['id']
    radii = request_data['radii']
    shape = request_data['shape']
    
    radii = [int(r) for r in radii.split(',')]
    precompute_edge_intensities(session['volumePath'], id, radii, shape)
    return jsonify({'status':'ok'}), 200

@app.route('/precomputePolarizations', methods=['POST'])
def start_precomputation_polarizations():
    
    request_data = request.get_json()
    
    id  = int(request_data['id'])
    radii = request_data['radii']
    
    radii = [int(r) for r in radii.split(',')]
    precompute_polarizations(session['volumePath'], id, radii)
    return jsonify({'status':'ok'}), 200

    
if __name__ == '__main__':
    app.run(host="0.0.0.0", port=8080)