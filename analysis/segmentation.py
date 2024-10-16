import numpy as np
import time, os, sys
import matplotlib.pyplot as plt
import matplotlib as mpl
mpl.rcParams['figure.dpi'] = 300
from cellpose import utils, io
import h5py
import os
from tqdm import tqdm
from cellpose import models, io

marker_names = ["DNA1","PD1","TLR3","SOX10","DNA2","CD163",
"CD3D","PDL1","DNA3","CD4","ICOS","HLADPB1","DNA4","CD8A",
"CD68","GZMB","DNA5","CD40L","LAG3","HLAA","DNA6","SQSTM",
"VIN","TIM3","DNA7","LAMP1/CD107A","PDL1_2","PD1_2"]

def generate_cube(file, cut_offs):
    img = io.imread(file)
    with h5py.File("data/cube.h5", "w") as cube:
        for c in tqdm(range(img.shape[1])):
            cube[marker_names[c]] = img[cut_offs[0]:cut_offs[1],c,:,:]
    return

def cellpose_segmentation(file, name, channel, cut_offs, cellpose_model, do_3D):
    model = models.Cellpose(gpu=True, model_type=cellpose_model)
    img = io.imread(file)
    if len(channel) > 1:
        img = img[cut_offs[0]:cut_offs[1],channel[0]:channel[1],:,:]
        masks, flows, styles, diams = model.eval(img, channels=[0,1], do_3D=do_3D)
    else:
        img = img[cut_offs[0]:cut_offs[1],channel[0],:,:]
        masks, flows, styles, diams = model.eval(img, channels=[0,0], do_3D=do_3D)

    with h5py.File("data/cube.h5", "a") as cube:
        cube[name] = masks

    return