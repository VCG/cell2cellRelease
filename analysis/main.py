from clustering import dbscan_markers, hdbscan_markers, prepare_cube, generate_pairwise_distances
import h5py
import numpy as np
#from segmentation import cellpose_segmentation, generate_cube

def main():
    #generate_cube("data/1_01_R3D_D3D_3D_MERGED.tif", [30,70])
    #cellpose_segmentation("data/1_01_R3D_D3D_3D_MERGED.tif", "DNA_masks", [19], [30,70], "nuclei", do_3D=True)
    #cellpose_segmentation("data/1_01_R3D_D3D_3D_MERGED.tif", "HLAA_masks", [19,21], [30,70], "cyto2", do_3D=False)
    cube = load_cube("PD1")
    coords = prepare_cube(cube)
    print("Calculating Distance Matrix")
    #distance_matrix = generate_pairwise_distances(coords)
    print("Clustering")
    #labels = dbscan_markers(distance_matrix, 1.0, 100, 1, False)
    labels = hdbscan_markers(coords, 500, gpu=False, metric="euclidean")
    print(np.unique(labels))


def load_cube(channel):
    with h5py.File("data/cube.h5", "r") as f:
        cube = np.array(f[channel])
        cube = cube/cube.max()
    return cube

if __name__ == "__main__":
    main()