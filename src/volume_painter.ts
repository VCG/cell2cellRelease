import * as THREE from 'three';
import fragmentShader from './volumeShader.frag';
import vertexShader from './volumeShader.vert';
import sliceVertexShader from './sliceShader.vert';
import fragmentShader2 from './volumeShader2.frag';
import fragmentShader3 from './volumeShader3.frag';
import fragmentShader4 from './volumeShader4.frag';
import fragmentShader5 from './volumeShader5.frag';
import fragmentShader6 from './volumeShader6.frag';
import sliceFragmentShader from './sliceShader.frag';
import {ChannelConfig, Config} from './app';
import {WorkerClass} from './worker';


export class VolumePainter {
    private scene: THREE.Scene;
    private config: Config;
    private camera: THREE.OrthographicCamera;
    public material: THREE.ShaderMaterial;
    public sliceMaterial: THREE.ShaderMaterial;
    private workers: WorkerClass[];
    private cache: Map<string, Volume>;
    private sliceScene: THREE.Scene;
    private sliceCamera: THREE.OrthographicCamera | THREE.PerspectiveCamera;
    private clippingPlane: THREE.Vector3;
    public volumeSize?: THREE.Vector3;
    public textures: THREE.Texture[] = [];

    constructor(
        scene: THREE.Scene, config: Config, camera: THREE.OrthographicCamera,
        sliceScene: THREE.Scene,
        sliceCamera: THREE.OrthographicCamera | THREE.PerspectiveCamera,
        clippingPlane: THREE.Vector3) {
        this.scene = scene;
        this.config = config;
        this.camera = camera;
        this.material = new THREE.ShaderMaterial();
        this.sliceMaterial = new THREE.ShaderMaterial();
        this.workers = [new WorkerClass(), new WorkerClass(), new WorkerClass()];
        this.cache = new Map<string, Volume>();
        this.sliceScene = sliceScene;
        this.sliceCamera = sliceCamera;
        this.clippingPlane = clippingPlane;
    }

    private async getVolumes(channels: string[]): Promise<Volume[]> {
        const neededChannels: string[] = [];

        for (const channel of channels) {
            if (!this.cache.has(channel)) {
                neededChannels.push(channel);
            }
        }

        const volumePromises: Promise<Volume>[] = [];

        for (let i = 0; i < neededChannels.length; i++) {
            const volume = this.workers[i].getVolume(neededChannels[i]);
            volumePromises.push(volume);
        }

        for (let i = 0; i < neededChannels.length; i++) {
            this.cache.set(neededChannels[i], await volumePromises[i]);
        }

        return channels.map((channel) => this.cache.get(channel) as Volume);
    }

    public async paintVolume(
        channels: string[],
        geoColor?: THREE.Texture, geoDepth?: THREE.Texture) {
        document.getElementById('loading_text')!.style.display = 'block';
        const textures = [] as THREE.Texture[];
        const volumes = await this.getVolumes(channels);
        console.log(volumes.length)
        const settings = [] as ChannelConfig[];
        for (let i = 0; i < volumes.length; i++) {
            const volume = volumes[i];
            const texture = new THREE.Data3DTexture(
                Uint8Array.from(volume.data),
                volume.xLength, volume.yLength, volume.zLength);
            texture.format = THREE.RedFormat;
            texture.minFilter = texture.magFilter = THREE.LinearFilter;
            texture.unpackAlignment = 1;
            texture.needsUpdate = true;
            textures.push(texture);
            if (channels[i] == 'first') {
                settings.push(Object.values(this.config.channelSettings)[0]);
                break;
            }
            settings.push(this.config.channelSettings[channels[i]]);
        }
        console.log(settings)

        this.textures = textures;

        const zScale = 2.0;
        let shader = VolumeRenderShader;
        const sliceShader = SliceShader;

        if (volumes.length > 1) {
            shader = VolumeRenderShader2;
        }
        if (volumes.length > 2) {
            shader = VolumeRenderShader3;
        }
        if (volumes.length > 3) {
            shader = VolumeRenderShader4;
        }
        if (volumes.length > 4) {
            shader = VolumeRenderShader5;
        }
        if (volumes.length > 5) {
            shader = VolumeRenderShader6;
        }

        let uniforms = THREE.UniformsUtils.clone(shader.uniforms);

        if (volumes.length > 5) {
            uniforms = THREE.UniformsUtils.clone(shader.uniforms);
            uniforms['u_data6'].value = textures[5];
            uniforms['u_clim6'].value.set(settings[5].clim1, settings[5].clim2);
            uniforms['u_renderthreshold6'].value = settings[5].threshold;
            const color6 = new THREE.Color(settings[5].color);
            uniforms['u_color6'].value = new THREE.Vector4(...color6.toArray(), 1);
            uniforms['dt_scale6'].value = settings[5].opacity;
        }

        if (volumes.length > 4) {
            uniforms = THREE.UniformsUtils.clone(shader.uniforms);
            uniforms['u_data5'].value = textures[4];
            uniforms['u_clim5'].value.set(settings[4].clim1, settings[4].clim2);
            uniforms['u_renderthreshold5'].value = settings[4].threshold;
            const color5 = new THREE.Color(settings[4].color);
            uniforms['u_color5'].value = new THREE.Vector4(...color5.toArray(), 1);
            uniforms['dt_scale5'].value = settings[4].opacity;
        }

        if (volumes.length > 3) {
            uniforms = THREE.UniformsUtils.clone(shader.uniforms);
            uniforms['u_data4'].value = textures[3];
            uniforms['u_clim4'].value.set(settings[3].clim1, settings[3].clim2);
            uniforms['u_renderthreshold4'].value = settings[3].threshold;
            const color4 = new THREE.Color(settings[3].color);
            uniforms['u_color4'].value = new THREE.Vector4(...color4.toArray(), 1);
            uniforms['dt_scale4'].value = settings[3].opacity;
        }

        if (volumes.length > 2) {
            uniforms = THREE.UniformsUtils.clone(shader.uniforms);
            uniforms['u_data3'].value = textures[2];
            uniforms['u_clim3'].value.set(settings[2].clim1, settings[2].clim2);
            uniforms['u_renderthreshold3'].value = settings[2].threshold;
            const color3 = new THREE.Color(settings[2].color);
            uniforms['u_color3'].value = new THREE.Vector4(...color3.toArray(), 1);
            uniforms['dt_scale3'].value = settings[2].opacity;
        }

        if (volumes.length > 1) {
            uniforms['u_data2'].value = textures[1];
            uniforms['u_clim2'].value.set(settings[1].clim1, settings[1].clim2);
            uniforms['u_renderthreshold2'].value = settings[1].threshold;
            const color2 = new THREE.Color(settings[1].color);
            uniforms['u_color2'].value = new THREE.Vector4(...color2.toArray(), 1);
            uniforms['dt_scale2'].value = settings[1].opacity;
        }

        uniforms['u_geo_depth'].value = geoDepth;
        uniforms['u_geo_color'].value = geoColor;
        uniforms['u_camera_near'].value = this.camera.near;
        uniforms['u_camera_far'].value = this.camera.far;
        uniforms['u_window_size'].value = new THREE.Vector2(window.innerWidth,
            window.innerHeight);
        uniforms['u_size'].value.set(
            volumes[0].xLength, volumes[0].yLength, volumes[0].zLength * zScale);
        uniforms['u_renderstyle'].value = 1;

        uniforms['u_data'].value = textures[0];
        uniforms['u_clim'].value.set(settings[0].clim1, settings[0].clim2);
        uniforms['u_renderthreshold'].value = settings[0].threshold;
        const color = new THREE.Color(settings[0].color);
        uniforms['u_color'].value = new THREE.Vector4(...color.toArray(), 1);
        uniforms['dt_scale'].value = settings[0].opacity;

        const sliceUniforms = THREE.UniformsUtils.clone(uniforms);
        sliceUniforms['clip_plane'] = {value: this.clippingPlane};

        const material = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: shader.vertexShader,
            fragmentShader: shader.fragmentShader,
            transparent: true,
            side: THREE.DoubleSide,
        });

        const sliceMaterial = new THREE.ShaderMaterial({
            uniforms: sliceUniforms,
            vertexShader: sliceShader.vertexShader,
            fragmentShader: sliceShader.fragmentShader,
            side: THREE.DoubleSide,
        });

        this.material = material;
        this.sliceMaterial = sliceMaterial;

        const geometry = new THREE.BoxGeometry(
            volumes[0].xLength, volumes[0].yLength, volumes[0].zLength * zScale);

        this.volumeSize = new THREE.Vector3(volumes[0].xLength, volumes[0].yLength,
            volumes[0].zLength * zScale);

        geometry.translate(
            volumes[0].xLength / 2,
            volumes[0].yLength / 2,
            volumes[0].zLength * zScale / 2);

        const mesh = new THREE.Mesh(geometry, material);

        const sliceMesh = new THREE.Mesh(geometry, sliceMaterial);

        mesh.translateX(-volumes[0].xLength / 2);
        mesh.translateY(-volumes[0].yLength / 2);
        mesh.translateZ(-volumes[0].zLength * zScale / 2);
        mesh.type = 'volume';

        sliceMesh.translateX(-volumes[0].xLength / 2);
        sliceMesh.translateY(-volumes[0].yLength / 2);
        sliceMesh.translateZ(-volumes[0].zLength * zScale / 2);
        sliceMesh.type = 'slice';

        const children = this.scene.children.filter((child) =>
            child.type === 'volume');
        children.forEach((child) => {
            this.scene.remove(child);
        });
        this.scene.add(mesh);
        this.sliceScene.add(sliceMesh);
        document.getElementById('loading_text')!.style.display = 'none';
    }
}

export interface Volume {
    xLength: number;
    yLength: number;
    zLength: number;
    data: Uint8Array;
}


export const colorValues: { [key: string]: THREE.Color } = {
    'red': new THREE.Color(1, 0, 0),
    'green': new THREE.Color(0, 1, 0),
    'yellow': new THREE.Color(1, 1, 0),
    'cyan': new THREE.Color(0, 1, 1),
    'magenta': new THREE.Color(1, 0, 1),
    'white': new THREE.Color(1, 1, 1),
};

export const VolumeRenderShader = {
    uniforms: {
        'u_size': {value: new THREE.Vector3(1, 1, 1)},
        'u_renderstyle': {value: 0},
        'u_renderthreshold': {value: 0.5},
        'u_clim': {value: new THREE.Vector2(0, 0.5)},
        'u_data': {value: null},
        'u_color': {value: new THREE.Vector4(1, 0, 0, 1)},
        'dt_scale': {value: 1.0},
        'u_geo_depth': {value: null},
        'u_geo_color': {value: null},
        'u_window_size': {
            value: new THREE.Vector2(window.innerWidth,
                window.innerHeight)
        },
        'u_camera_near': {value: null},
        'u_camera_far': {value: null},
    },
    fragmentShader: fragmentShader,

    vertexShader: vertexShader,
};

export const VolumeRenderShader2 = {
    uniforms: {
        'u_size': {value: new THREE.Vector3(1, 1, 1)},
        'u_renderstyle': {value: 0},
        'u_renderthreshold': {value: 0.5},
        'u_renderthreshold2': {value: 0.5},
        'u_clim': {value: new THREE.Vector2(0, 0.5)},
        'u_clim2': {value: new THREE.Vector2(0, 0.5)},
        'u_data': {value: null},
        'u_data2': {value: null},
        'u_color': {value: new THREE.Vector4(1, 0, 0, 1)},
        'u_color2': {value: new THREE.Vector4(1, 0, 0, 1)},
        'dt_scale': {value: 1.0},
        'dt_scale2': {value: 1.0},
        'u_geo_depth': {value: null},
        'u_geo_color': {value: null},
        'u_window_size': {
            value: new THREE.Vector2(window.innerWidth,
                window.innerHeight)
        },
        'u_camera_near': {value: null},
        'u_camera_far': {value: null},
    },
    fragmentShader: fragmentShader2,

    vertexShader: vertexShader,
};

export const VolumeRenderShader3 = {
    uniforms: {
        'u_size': {value: new THREE.Vector3(1, 1, 1)},
        'u_renderstyle': {value: 0},
        'u_renderthreshold': {value: 0.5},
        'u_renderthreshold2': {value: 0.5},
        'u_renderthreshold3': {value: 0.5},
        'u_clim': {value: new THREE.Vector2(0, 0.5)},
        'u_clim2': {value: new THREE.Vector2(0, 0.5)},
        'u_clim3': {value: new THREE.Vector2(0, 0.5)},
        'u_data': {value: null},
        'u_data2': {value: null},
        'u_data3': {value: null},
        'u_color': {value: new THREE.Vector4(1, 0, 0, 1)},
        'u_color2': {value: new THREE.Vector4(1, 0, 0, 1)},
        'u_color3': {value: new THREE.Vector4(1, 0, 0, 1)},
        'dt_scale': {value: 1.0},
        'dt_scale2': {value: 1.0},
        'dt_scale3': {value: 1.0},
        'u_geo_depth': {value: null},
        'u_geo_color': {value: null},
        'u_window_size': {
            value: new THREE.Vector2(window.innerWidth,
                window.innerHeight)
        },
        'u_camera_near': {value: null},
        'u_camera_far': {value: null},
    },
    fragmentShader: fragmentShader3,

    vertexShader: vertexShader,
};

export const VolumeRenderShader4 = {
    uniforms: {
        'u_size': {value: new THREE.Vector3(1, 1, 1)},
        'u_renderstyle': {value: 0},
        'u_renderthreshold': {value: 0.5},
        'u_renderthreshold2': {value: 0.5},
        'u_renderthreshold3': {value: 0.5},
        'u_renderthreshold4': {value: 0.5},
        'u_clim': {value: new THREE.Vector2(0, 0.5)},
        'u_clim2': {value: new THREE.Vector2(0, 0.5)},
        'u_clim3': {value: new THREE.Vector2(0, 0.5)},
        'u_clim4': {value: new THREE.Vector2(0, 0.5)},
        'u_data': {value: null},
        'u_data2': {value: null},
        'u_data3': {value: null},
        'u_data4': {value: null},
        'u_color': {value: new THREE.Vector4(1, 0, 0, 1)},
        'u_color2': {value: new THREE.Vector4(1, 0, 0, 1)},
        'u_color3': {value: new THREE.Vector4(1, 0, 0, 1)},
        'u_color4': {value: new THREE.Vector4(1, 0, 0, 1)},
        'dt_scale': {value: 1.0},
        'dt_scale2': {value: 1.0},
        'dt_scale3': {value: 1.0},
        'dt_scale4': {value: 1.0},
        'u_geo_depth': {value: null},
        'u_geo_color': {value: null},
        'u_window_size': {
            value: new THREE.Vector2(window.innerWidth,
                window.innerHeight)
        },
        'u_camera_near': {value: null},
        'u_camera_far': {value: null},
    },
    fragmentShader: fragmentShader4,

    vertexShader: vertexShader,
};

export const VolumeRenderShader5 = {
    uniforms: {
        'u_size': {value: new THREE.Vector3(1, 1, 1)},
        'u_renderstyle': {value: 0},
        'u_renderthreshold': {value: 0.5},
        'u_renderthreshold2': {value: 0.5},
        'u_renderthreshold3': {value: 0.5},
        'u_renderthreshold4': {value: 0.5},
        'u_renderthreshold5': {value: 0.5},
        'u_clim': {value: new THREE.Vector2(0, 0.5)},
        'u_clim2': {value: new THREE.Vector2(0, 0.5)},
        'u_clim3': {value: new THREE.Vector2(0, 0.5)},
        'u_clim4': {value: new THREE.Vector2(0, 0.5)},
        'u_clim5': {value: new THREE.Vector2(0, 0.5)},
        'u_data': {value: null},
        'u_data2': {value: null},
        'u_data3': {value: null},
        'u_data4': {value: null},
        'u_data5': {value: null},
        'u_color': {value: new THREE.Vector4(1, 0, 0, 1)},
        'u_color2': {value: new THREE.Vector4(1, 0, 0, 1)},
        'u_color3': {value: new THREE.Vector4(1, 0, 0, 1)},
        'u_color4': {value: new THREE.Vector4(1, 0, 0, 1)},
        'u_color5': {value: new THREE.Vector4(1, 0, 0, 1)},
        'dt_scale': {value: 1.0},
        'dt_scale2': {value: 1.0},
        'dt_scale3': {value: 1.0},
        'dt_scale4': {value: 1.0},
        'dt_scale5': {value: 1.0},
        'u_geo_depth': {value: null},
        'u_geo_color': {value: null},
        'u_window_size': {
            value: new THREE.Vector2(window.innerWidth,
                window.innerHeight)
        },
        'u_camera_near': {value: null},
        'u_camera_far': {value: null},
    },
    fragmentShader: fragmentShader5,

    vertexShader: vertexShader,
};

export const VolumeRenderShader6 = {
    uniforms: {
        'u_size': {value: new THREE.Vector3(1, 1, 1)},
        'u_renderstyle': {value: 0},
        'u_renderthreshold': {value: 0.5},
        'u_renderthreshold2': {value: 0.5},
        'u_renderthreshold3': {value: 0.5},
        'u_renderthreshold4': {value: 0.5},
        'u_renderthreshold5': {value: 0.5},
        'u_renderthreshold6': {value: 0.5},
        'u_clim': {value: new THREE.Vector2(0, 0.5)},
        'u_clim2': {value: new THREE.Vector2(0, 0.5)},
        'u_clim3': {value: new THREE.Vector2(0, 0.5)},
        'u_clim4': {value: new THREE.Vector2(0, 0.5)},
        'u_clim5': {value: new THREE.Vector2(0, 0.5)},
        'u_clim6': {value: new THREE.Vector2(0, 0.5)},
        'u_data': {value: null},
        'u_data2': {value: null},
        'u_data3': {value: null},
        'u_data4': {value: null},
        'u_data5': {value: null},
        'u_data6': {value: null},
        'u_color': {value: new THREE.Vector4(1, 0, 0, 1)},
        'u_color2': {value: new THREE.Vector4(1, 0, 0, 1)},
        'u_color3': {value: new THREE.Vector4(1, 0, 0, 1)},
        'u_color4': {value: new THREE.Vector4(1, 0, 0, 1)},
        'u_color5': {value: new THREE.Vector4(1, 0, 0, 1)},
        'u_color6': {value: new THREE.Vector4(1, 0, 0, 1)},
        'dt_scale': {value: 1.0},
        'dt_scale2': {value: 1.0},
        'dt_scale3': {value: 1.0},
        'dt_scale4': {value: 1.0},
        'dt_scale5': {value: 1.0},
        'dt_scale6': {value: 1.0},
        'u_geo_depth': {value: null},
        'u_geo_color': {value: null},
        'u_window_size': {
            value: new THREE.Vector2(window.innerWidth,
                window.innerHeight)
        },
        'u_camera_near': {value: null},
        'u_camera_far': {value: null},
    },
    fragmentShader: fragmentShader6,

    vertexShader: vertexShader,
};


export const SliceShader = {
    uniforms: {
        'u_size': {value: new THREE.Vector3(1, 1, 1)},
        'u_renderstyle': {value: 0},
        'u_renderthreshold': {value: 0.5},
        'u_renderthreshold2': {value: 0.5},
        'u_renderthreshold3': {value: 0.5},
        'u_clim': {value: new THREE.Vector2(0, 0.5)},
        'u_clim2': {value: new THREE.Vector2(0, 0.5)},
        'u_clim3': {value: new THREE.Vector2(0, 0.5)},
        'u_data': {value: null},
        'u_data2': {value: null},
        'u_data3': {value: null},
        'u_color': {value: new THREE.Vector4(1, 0, 0, 1)},
        'u_color2': {value: new THREE.Vector4(1, 0, 0, 1)},
        'u_color3': {value: new THREE.Vector4(1, 0, 0, 1)},
        'dt_scale': {value: 1.0},
        'dt_scale2': {value: 1.0},
        'dt_scale3': {value: 1.0},
        'u_geo_depth': {value: null},
        'u_geo_color': {value: null},
        'u_window_size': {
            value: new THREE.Vector2(window.innerWidth,
                window.innerHeight)
        },
        'u_camera_near': {value: null},
        'u_camera_far': {value: null},
        'clip_plane': {value: 1.0},
    },
    fragmentShader: sliceFragmentShader,

    vertexShader: sliceVertexShader,
};

