import numpy as np
from sklearn.cluster import DBSCAN
from sklearn.metrics import pairwise_distances
import h5py
import matplotlib.pyplot as plt
from tqdm import tqdm
from hdbscan import HDBSCAN

def cube_2_coords(cube, threshold=0):
    coords = []
    np_coords = np.where(cube >= threshold)
    for z,y,x in tqdm(zip(*np_coords), total=len(np_coords[0])):
        coords.append([z, y, x, cube[z, y, x]])
    return np.array(coords, dtype=np.float32)

def prepare_cube(cube, threshold=0):
    coords = cube_2_coords(cube, threshold)
    return coords

def generate_pairwise_distances(X, metric="euclidean"):
    return pairwise_distances(X, metric=metric)


def dbscan_markers(X, eps, min_samples, n_jobs=1, gpu=False, metric="euclidean"):
    from sklearnex import patch_sklearn, config_context
    patch_sklearn()
    if gpu:
        with config_context(target_offload="gpu:0"):
            db = DBSCAN(eps=eps, min_samples=min_samples, metric=metric)
            db.fit(X)
    else:
        db = DBSCAN(eps=eps, min_samples=min_samples, n_jobs=n_jobs, metric=metric)
        db.fit(X)
    labels = db.labels_
    return labels

def hdbscan_markers(X, min_cluster_size, gpu=False, metric="euclidean"):
    if gpu:
        from cuml.cluster import HDBSCAN
        
        db = HDBSCAN(min_cluster_size=min_cluster_size, metric=metric)
        db.fit(X)
    else:
        from hdbscan import HDBSCAN

        db = HDBSCAN(min_cluster_size=min_cluster_size, metric=metric)
        db.fit(X)
    labels = db.labels_
    return labels