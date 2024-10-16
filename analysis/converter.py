import tifffile
import numpy as np
import zarr

def convertTiff(source, target, format='zarr'):
    img = tifffile.imread(source)
    img = np.moveaxis(img, 0, 1)
    if format == "n5":
        store = zarr.N5Store(target)
        z = zarr.zeros(img.shape, chunks=True, store=store, overwrite=True)
        z[:] = img

    elif format == "zarr":
        zarr.save(target, img)
    
    else:
        raise ValueError("Invalid format")
