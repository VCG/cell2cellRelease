import * as THREE from 'three';
import {TrackballControls} from 'three/examples/jsm/controls/TrackballControls';
import {FolderApi, InputBindingApi, Pane, TabApi} from 'tweakpane';
import {GeoPainter} from './geo_painter';
import {colorValues, VolumePainter} from './volume_painter';
import {
    backupSettings, onDocumentMouseDown, onDocumentMouseOver,
    restoreSettings, selectEdge, Mode, updateSliceViewPos,
    addCenterLinesSliceView, onKeyDown, onKeyUp,
} from './util';
import {Vizard} from './vis';
import './style.css';
import * as d3 from 'd3';

export class App {
    private finalScene: THREE.Scene;
    public geometricScene: THREE.Scene;
    private sliceScene: THREE.Scene;
    private geometricTarget: THREE.WebGLRenderTarget;
    private geo_color?: THREE.Texture;
    private geo_depth?: THREE.Texture;
    private camera: THREE.OrthographicCamera;
    private sliceCamera: THREE.OrthographicCamera | THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private sliceRenderer: THREE.WebGLRenderer;
    private controls: TrackballControls;
    private config: Config;
    private channels?: string[];
    public geoPainter: GeoPainter;
    public volumePainter: VolumePainter;
    private vizard: Vizard;
    private gui?: myGui;
    private oldChannel: string;
    public mode: number;
    public editingSphere?: THREE.Mesh;
    public clippingPlane: THREE.Vector3;
    public mousePos: THREE.Vector3;


    constructor() {
        this.mode = Mode.Analysis;
        this.finalScene = new THREE.Scene();
        this.geometricScene = new THREE.Scene();
        this.sliceScene = new THREE.Scene();
        // this.sliceScene2 = new THREE.Scene();
        // this.sliceScene3 = new THREE.Scene();
        //    this.geometricScene.background = new THREE.Color('black');
        this.finalScene.background = new THREE.Color('black');
        const width = window.innerWidth - 10;
        const height = window.innerHeight - 18;
        window.addEventListener('resize', (event) => this.adapteSize());
        this.adapteSize();

        this.geometricTarget =
            new THREE.WebGLRenderTarget(width, height);
        this.camera =
            new THREE.OrthographicCamera(
                width / -2, width / 2, height / 2, height / -2, 1, 2000);
        this.camera.position.x = 0;
        this.camera.position.y = 0;
        this.camera.position.z = 1400;


        this.sliceCamera =
            new THREE.PerspectiveCamera(45, width / height, 1, 2000);

        this.sliceCamera.position.x = 0;
        this.sliceCamera.position.y = 0;
        this.sliceCamera.position.z = 500;

        /*
                this.sliceCamera2 =
                new THREE.OrthographicCamera(
                    width / - 2, width / 2, height / 2, height / - 2, 1, 2000);

                this.sliceCamera2.position.x = 1400;
                this.sliceCamera2.position.y = 0;
                this.sliceCamera2.position.z = 0;

                this.sliceCamera3 =
            new THREE.OrthographicCamera(
                width / - 2, width / 2, height / 2, height / - 2, 1, 2000);

                this.sliceCamera3.position.x = 0;
                this.sliceCamera3.position.y = 1400;
                this.sliceCamera3.position.z = 0;
                */

        this.camera.lookAt(0, 0, 0);
        this.sliceCamera.lookAt(0, 0, 0);


        const container = document.getElementById('canvas');
        this.renderer = new THREE.WebGLRenderer();
        this.sliceRenderer = new THREE.WebGLRenderer();
        // this.sliceRenderer2 = new THREE.WebGLRenderer();
        // this.sliceRenderer3 = new THREE.WebGLRenderer();
        this.renderer.setSize(width, height);
        this.sliceRenderer.setSize(400, 400);
        // this.sliceRenderer2.setSize(300, 300);
        // this.sliceRenderer3.setSize(300, 300);
        container!.appendChild(this.renderer.domElement);
        this.controls = this.createControls();

        document.getElementById('xy')!
            .appendChild(this.sliceRenderer.domElement);
        /*
        document.getElementById('yz')!
            .appendChild(this.sliceRenderer2.domElement);

        document.getElementById('xz')!
            .appendChild(this.sliceRenderer3.domElement);
    */
        this.config = {
            clim1: 0,
            clim2: 0.5,
            renderstyle: 'dvr',
            threshold: 0.1,
            channel: 'first',
            radius: 10,
            polarizationRadius: 10,
            opacity: 0.2,
            interactions: {},
            channels: {},
            color: '#ff0000',
            channelSettings: {},
            shape: 'cone',
            prepare: false,
            heatmap: false,
            interactions_visible: true,
            channels_visible: true,
            channels_heatmap: false,
            polarization_heatmap: false,
            thresholds: [],
            wantedInteractions: [],
            allThresholds: [],
            wireframe: true,
        };
        this.createGUI();
        this.oldChannel = 'first';
        this.clippingPlane = new THREE.Vector3(0, 0, -0.5);
        this.mousePos = new THREE.Vector3(0, 0, 0);
        this.geoPainter = new GeoPainter(this.geometricScene, this.config, this.camera);
        this.volumePainter =
            new VolumePainter(this.finalScene, this.config, this.camera,
                this.sliceScene, this.sliceCamera, this.clippingPlane);
        this.vizard = new Vizard(this.config);
        this.renderer.domElement.addEventListener('mousemove', (event) => {
            onDocumentMouseOver(event, this.geoPainter, this.geometricScene,
                this.finalScene, this.camera, this);
        }, false);

        this.renderer.domElement.addEventListener('mousedown', (event) => {
            // console.log("Renderer mouse down")
            onDocumentMouseDown(event, this.geoPainter, this.geometricScene,
                this.finalScene, this.camera, this, this.sliceScene);
        }, false);

        document.addEventListener('keydown', (event) => {
            onKeyDown(this.geoPainter, event);
        }, false);
        document.addEventListener('keyup', (event) => {
            onKeyUp(this.geoPainter, event, this.geometricScene, this);
        }, false);


        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default THREE.PCFShadowMap

        // Create a PointLight and turn on shadows for the light
        const light = new THREE.PointLight(0xffffff, 1, 100);
        light.position.set(0, 10, 14);
        light.castShadow = true; // default false
        this.geometricScene.add(light);

        // Set up shadow properties for the light
        light.shadow.mapSize.width = 512; // default
        light.shadow.mapSize.height = 512; // default
        light.shadow.camera.near = 1; // default
        light.shadow.camera.far = 2000; // default
    }

    private adapteSize() {
        const widthAvailable = window.innerWidth - 324 - 440;
        document.getElementById('dataviz_wrapper')!.style.width = widthAvailable + 'px';
        document.getElementById('polarization_dataviz_wrapper')!.style.width = widthAvailable + 'px';
    }

    public async start(): Promise<void> {
        this.geoPainter.buildGraph();
        await this.volumePainter.paintVolume(
            [this.config.channel], this.geo_color, this.geo_depth);
        this.animate();
        this.gui!.disabled = false;
    }

    private createControls(): TrackballControls {
        const controls = new TrackballControls(
            this.camera, this.renderer.domElement);
        controls.rotateSpeed = 2.0;
        controls.zoomSpeed = 0.2;
        controls.panSpeed = 0.8;
        controls.keys = ['KeyA', 'KeyS', 'KeyD'];

        return controls;
    }

    private async getChannels() {
        this.channels = await fetch('channels')
            .then((response) => response.json())
            .then((response) => Object.keys(response));

        this.config.channel = this.channels[0];
        this.oldChannel = this.channels[0];

        return this.channels;
    }

    private async createGUI() {
        const pane = new Pane({
            container: document.getElementById('gui')!,
        });

        this.gui = pane as myGui;

        this.gui.channelSettings = pane.addFolder({
            title: 'Channel Settings',
            expanded: true,
        });

        const channels = await this.getChannels();

        this.gui.channelDropdown = this.gui.channelSettings
            .addInput(this.config, 'channel', {
                options: [channels[0]].reduce((a, v) => ({...a, [v]: v}), {}),
            }).on('change', () => {
                this.changeChannelSettings();
            });

        this.gui.channelSettings.addInput(this.config, 'color');
        this.gui.channelSettings.addInput(this.config, 'clim1', {min: 0, max: 1, label: 'colormap min'});
        this.gui.channelSettings.addInput(this.config, 'clim2', {min: 0, max: 1, label: 'colormap max'});
        this.gui.channelSettings.addInput(this.config,
            'threshold', {min: 0, max: 1, step: 0.05}).on('change', (ev) => {
            if (ev.last) {
                this.getIntensities();
            }
        });
        this.gui.channelSettings.addInput(this.config, 'opacity', {min: 0, max: 1});


        this.gui.channelSettings.on('change', (ev) => {
            this.updateUniforms();
        });
        const interfaceSettings = pane.addFolder({
            title: 'Interface Settings',
            expanded: true,
        });

        interfaceSettings.addInput(this.config, 'interactions_visible',
            {label: 'Interactions Visible'}).on('change', (ev) => {
            if (ev.last) {
                if (this.config.interactions_visible) {
                    this.getIntensities();
                } else {
                    document.getElementById('small_dataviz_wrapper')!.style.display = 'none';
                }
            }
        });
        const heatmapInput = interfaceSettings.addInput(
            this.config, 'heatmap', {label: 'Interactions Heatmap'});
        heatmapInput.on('change', (ev) => {
            if (ev.last) {
                this.getIntensities(false, false, this.config.heatmap);
            }
        });
        interfaceSettings.addInput(this.config, 'channels_visible', {label: 'Channels Visible'}).on('change', (ev) => {
            if (ev.last) {
                if (this.config.channels_visible) {
                    this.getIntensities();
                } else {
                    document.getElementById('dataviz_wrapper')!.style.display = 'none';
                }
            }
        });
        interfaceSettings.addInput(this.config, 'channels_heatmap', {label: 'Channels Heatmap'}).on('change', (ev) => {
            if (ev.last) {
                this.getIntensities(false, this.config.channels_heatmap);
            }
        });
        interfaceSettings.addInput(this.config, 'polarization_heatmap',
            {label: 'Polarization Heatmap'}).on('change', (ev) => {
            if (ev.last && !this.config.polarization_heatmap) {
                document.getElementById('polarization_dataviz_wrapper')!.style.display = 'none';
            } else {
                document.getElementById('polarization_dataviz_wrapper')!.style.display = 'block';
            }
        });

        const analysisSettings = pane.addFolder({
            title: 'Analysis Settings',
            expanded: true,
        });

        const radiusInput = analysisSettings.addInput(
            this.config, 'radius', {label: 'edge radius', min: 5, max: 30, step: 5.0});

        radiusInput.on('change', (ev) => {
            if (ev.last) {
                this.updateRadius();
                this.getIntensities();
            }
        });

        const radiusInput2 = analysisSettings.addInput(
            this.config, 'polarizationRadius', {label: 'polarization radius', min: 5, max: 30, step: 5.0});

        radiusInput2.on('change', (ev) => {
            if (ev.last) {
                this.getPolarization();
            } else {
                this.geoPainter.drawTorusSpheres();
            }
        });

        const shapeSelect = analysisSettings.addInput(this.config, 'shape', {
            options: {
                cone: 'cone',
                cylinder: 'cylinder',
            }, label: 'Shape'
        });

        shapeSelect.on('change', (ev) => {
            this.geoPainter.buildGraph();
        });

        const wireframe = analysisSettings.addInput(
            this.config, 'wireframe');

        wireframe.on('change', (ev) => {
            if (ev.last) {
                this.getIntensities();
                this.geometricScene.children.forEach((child) => {
                    if (child.type === 'cone' || child.type === 'cylinder') {
                        child.visible = false;
                    }
                });
            }
        });

        const polarizationBtn = analysisSettings.addButton({
            title: 'Show Polarizations',
        });

        polarizationBtn.on('click', () => {
            this.getPolarization();
            this.geoPainter.torusOn = true;
        });

        const editingBtn = analysisSettings.addButton({
            title: 'Graph Editing Mode',
        });

        editingBtn.on('click', () => {
            this.startEditingMode();
        });

        const tab = analysisSettings.addTab({
            pages: [
                {title: 'Visible'},
                {title: 'Interactions'},
            ],
        });

        this.gui.analysisTabs = tab;

        channels.forEach((channel) => {
            this.config.interactions[channel] = false;
            this.config.channels[channel] = false;
            this.config.channels[this.config.channel] = true;
            this.config.interactions[this.config.channel] = true;

            tab.pages[0].addInput(this.config.channels, channel.toString())
                .on('change', (ev) => {
                    this.changeChannels();
                });
            tab.pages[1].addInput(this.config.interactions, channel.toString())
                .on('change', (ev) => {
                    this.getIntensities();
                });
        });

        let colorCount = 0;
        const colors = Object.values(colorValues).map((color) => {
            return '#' + color.getHexString();
        });
        channels.forEach((channel) => {
            backupSettings(this.config, channel);
            this.config.channelSettings[channel]['color'] =
                colors[colorCount % colors.length];
            colorCount++;
        });
        this.gui.disabled = true;
    }

    private updateUniforms() {
        backupSettings(this.config, this.config.channel);

        const selectedChannels = Object.keys(this.config.channels)
            .filter((k) => this.config.channels[k])
            .map(String);

        let settings = this.config.channelSettings[selectedChannels[0]];

        this.volumePainter.material.uniforms['u_clim']
            .value.set(settings.clim1, settings.clim2);
        this.volumePainter.material.uniforms['u_renderstyle']
            .value = settings.renderstyle == 'iso' ? 0 : 1; // 0: DVR, 1: ISO
        this.volumePainter.material.uniforms['u_renderthreshold']
            .value = settings.threshold;
        this.volumePainter.material.uniforms['u_color']
            .value = new THREE.Vector4(...(
            new THREE.Color(settings.color).toArray()), 1);
        this.volumePainter.material.uniforms['dt_scale'].value = settings.opacity;

        this.volumePainter.sliceMaterial.uniforms['u_clim']
            .value.set(settings.clim1, settings.clim2);
        this.volumePainter.sliceMaterial.uniforms['u_renderstyle']
            .value = settings.renderstyle == 'iso' ? 0 : 1; // 0: DVR, 1: ISO
        this.volumePainter.sliceMaterial.uniforms['u_renderthreshold']
            .value = settings.threshold;
        this.volumePainter.sliceMaterial.uniforms['u_color']
            .value = new THREE.Vector4(...(
            new THREE.Color(settings.color).toArray()), 1);
        this.volumePainter.sliceMaterial.uniforms['dt_scale'].value =
            settings.opacity;

        if (selectedChannels.length > 1) {
            settings = this.config.channelSettings[selectedChannels[1]];

            this.volumePainter.material.uniforms['u_clim2']
                .value.set(settings.clim1, settings.clim2);
            this.volumePainter.material.uniforms['u_renderthreshold2']
                .value = settings.threshold;
            this.volumePainter.material.uniforms['u_color2']
                .value = new THREE.Vector4(...(
                new THREE.Color(settings.color).toArray()), 1);
            this.volumePainter.material.uniforms['dt_scale2']
                .value = settings.opacity;


            this.volumePainter.sliceMaterial.uniforms['u_clim2']
                .value.set(settings.clim1, settings.clim2);
            this.volumePainter.sliceMaterial.uniforms['u_renderthreshold2']
                .value = settings.threshold;
            this.volumePainter.sliceMaterial.uniforms['u_color2']
                .value = new THREE.Vector4(...(
                new THREE.Color(settings.color).toArray()), 1);
            this.volumePainter.sliceMaterial.uniforms['dt_scale2']
                .value = settings.opacity;

            this.volumePainter.sliceMaterial
                .uniforms['u_data2'].value = this.volumePainter.textures[1];
        }

        if (selectedChannels.length > 2) {
            settings = this.config.channelSettings[selectedChannels[2]];

            this.volumePainter.material.uniforms['u_clim3']
                .value.set(settings.clim1, settings.clim2);
            this.volumePainter.material.uniforms['u_renderthreshold3']
                .value = settings.threshold;
            this.volumePainter.material.uniforms['u_color3']
                .value = new THREE.Vector4(...(
                new THREE.Color(settings.color).toArray()), 1);
            this.volumePainter.material.uniforms['dt_scale3']
                .value = settings.opacity;

            this.volumePainter.sliceMaterial.uniforms['u_clim3']
                .value.set(settings.clim1, settings.clim2);
            this.volumePainter.sliceMaterial.uniforms['u_renderthreshold3']
                .value = settings.threshold;
            this.volumePainter.sliceMaterial.uniforms['u_color3']
                .value = new THREE.Vector4(...(
                new THREE.Color(settings.color).toArray()), 1);
            this.volumePainter.sliceMaterial.uniforms['dt_scale3']
                .value = settings.opacity;

            this.volumePainter.sliceMaterial
                .uniforms['u_data3'].value = this.volumePainter.textures[2];
        }

        if (selectedChannels.length > 3) {
            settings = this.config.channelSettings[selectedChannels[3]];

            this.volumePainter.material.uniforms['u_clim4']
                .value.set(settings.clim1, settings.clim2);
            this.volumePainter.material.uniforms['u_renderthreshold4']
                .value = settings.threshold;
            this.volumePainter.material.uniforms['u_color4']
                .value = new THREE.Vector4(...(
                new THREE.Color(settings.color).toArray()), 1);
            this.volumePainter.material.uniforms['dt_scale4']
                .value = settings.opacity;

            this.volumePainter.sliceMaterial.uniforms['u_clim4']
                .value.set(settings.clim1, settings.clim2);
            this.volumePainter.sliceMaterial.uniforms['u_renderthreshold4']
                .value = settings.threshold;
            this.volumePainter.sliceMaterial.uniforms['u_color4']
                .value = new THREE.Vector4(...(
                new THREE.Color(settings.color).toArray()), 1);
            this.volumePainter.sliceMaterial.uniforms['dt_scale4']
                .value = settings.opacity;

            this.volumePainter.sliceMaterial
                .uniforms['u_data4'].value = this.volumePainter.textures[3];
        }

        if (selectedChannels.length > 4) {
            settings = this.config.channelSettings[selectedChannels[4]];

            this.volumePainter.material.uniforms['u_clim5']
                .value.set(settings.clim1, settings.clim2);
            this.volumePainter.material.uniforms['u_renderthreshold5']
                .value = settings.threshold;
            this.volumePainter.material.uniforms['u_color5']
                .value = new THREE.Vector4(...(
                new THREE.Color(settings.color).toArray()), 1);
            this.volumePainter.material.uniforms['dt_scale5']
                .value = settings.opacity;

            this.volumePainter.sliceMaterial.uniforms['u_clim5']
                .value.set(settings.clim1, settings.clim2);
            this.volumePainter.sliceMaterial.uniforms['u_renderthreshold5']
                .value = settings.threshold;
            this.volumePainter.sliceMaterial.uniforms['u_color5']
                .value = new THREE.Vector4(...(
                new THREE.Color(settings.color).toArray()), 1);
            this.volumePainter.sliceMaterial.uniforms['dt_scale5']
                .value = settings.opacity;

            this.volumePainter.sliceMaterial
                .uniforms['u_data5'].value = this.volumePainter.textures[4];
        }

        if (selectedChannels.length > 5) {
            settings = this.config.channelSettings[selectedChannels[5]];

            this.volumePainter.material.uniforms['u_clim6']
                .value.set(settings.clim1, settings.clim2);
            this.volumePainter.material.uniforms['u_renderthreshold6']
                .value = settings.threshold;
            this.volumePainter.material.uniforms['u_color6']
                .value = new THREE.Vector4(...(
                new THREE.Color(settings.color).toArray()), 1);
            this.volumePainter.material.uniforms['dt_scale6']
                .value = settings.opacity;

            this.volumePainter.sliceMaterial.uniforms['u_clim6']
                .value.set(settings.clim1, settings.clim2);
            this.volumePainter.sliceMaterial.uniforms['u_renderthreshold6']
                .value = settings.threshold;
            this.volumePainter.sliceMaterial.uniforms['u_color6']
                .value = new THREE.Vector4(...(
                new THREE.Color(settings.color).toArray()), 1);
            this.volumePainter.sliceMaterial.uniforms['dt_scale6']
                .value = settings.opacity;

            this.volumePainter.sliceMaterial
                .uniforms['u_data6'].value = this.volumePainter.textures[5];
        }

        this.vizard.updateColors();
    }

    private updateRadius() {
        this.geoPainter.buildGraph();
    }

    private async changeChannels() {
        this.disableSettings();
        this.gui!.disabled = true;
        this.updateChannelDropdown();

        const selectedChannels = Object.keys(this.config.channels)
            .filter((k) => this.config.channels[k])
            .map(String);
        console.log(selectedChannels)
        await this.volumePainter
            .paintVolume(selectedChannels, this.geo_color, this.geo_depth);
        this.gui!.disabled = false;
    }

    private updateChannelDropdown() {
        const selectedChannels = Object.keys(this.config.channels)
            .filter((k) => this.config.channels[k])
            .map(String);

        for (const key in this.config.interactions) {
            if (this.config.interactions[key] && !selectedChannels.includes(key)) {
                selectedChannels.push(key);
            }
        }

        console.log(selectedChannels)

        this.gui!.channelDropdown.dispose();

        this.gui!.channelDropdown = this.gui!.channelSettings
            .addInput(this.config, 'channel', {
                options: selectedChannels.reduce((a, v) =>
                    ({...a, [v]: v}), {}),
                index: 0,
            }).on('change', () => {
                this.changeChannelSettings();
            });
    }

    private changeChannelSettings() {
        this.disableSettings();
        backupSettings(this.config, this.oldChannel);
        restoreSettings(this.config, this.config.channel);
        this.oldChannel = this.config.channel;
        this.gui?.refresh();
    }

    private disableSettings() {
        const channelCount = Object
            .values(this.config.channels)
            .reduce((a, item) => a + (item === true ? 1 : 0), 0);
        const interactionCount = Object
            .values(this.config.interactions)
            .reduce((a, item) => a + (item === true ? 1 : 0), 0);
        const visibleTab = this.gui!.analysisTabs.pages[0];
        const interactionTab = this.gui!.analysisTabs.pages[1];
        const channelNames = Object.keys(this.config.channels);

        if (channelCount > 5) {
            for (let i = 0; i < visibleTab!.children.length; i++) {
                if (!this.config.channels[channelNames[i]]) {
                    visibleTab!.children[i].disabled = true;
                }
            }
        } else {
            for (let i = 0; i < visibleTab!.children.length; i++) {
                visibleTab!.children[i].disabled = false;
            }
        }

        if (interactionCount > 5) {
            for (let i = 0; i < interactionTab!.children.length; i++) {
                if (!this.config.interactions[channelNames[i]]) {
                    interactionTab!.children[i].disabled = true;
                }
            }
        } else {
            for (let i = 0; i < interactionTab!.children.length; i++) {
                interactionTab!.children[i].disabled = false;
            }
        }
    }

    private animate() {
        requestAnimationFrame(this.animate.bind(this));
        this.controls.update();
        this.renderer.render(this.finalScene, this.camera);
        this.renderer.autoClear = false;
        this.renderer.render(this.geometricScene, this.camera);
        //this.renderer.clearDepth();
        this.renderer.autoClear = true;
        // this.geo_color = this.geometricTarget.texture;
        // this.geo_depth = this.geometricTarget.depthTexture;

        this.sliceRenderer.render(this.sliceScene, this.sliceCamera);
    }

    public async getIntensities(interactionsChanged: boolean = false,
                                channelsHeatMapActivated: boolean = false,
                                interactionsHeatMapActivated: boolean = false) {
        this.disableSettings();
        this.updateChannelDropdown();
        const wantedInteractions = [];
        const thresholds = [];
        const allThresholds = [];
        // eslint-disable-next-line guard-for-in
        for (const key in this.config.interactions) {
            allThresholds.push(this.config.channelSettings[key].threshold);
            if (this.config.interactions[key]) {
                wantedInteractions.push(key);
                thresholds.push(this.config.channelSettings[key].threshold);
            }
        }
        this.config.thresholds = thresholds;
        this.config.wantedInteractions = wantedInteractions;
        this.config.allThresholds = allThresholds;
        if ((wantedInteractions.length == 0 && !this.config.heatmap && !this.config.channels_heatmap) ||
            (this.geoPainter.selectedEdge.length == 0 && !this.config.heatmap && !this.config.channels_heatmap) ||
            (wantedInteractions.length == 0 && this.config.channels_heatmap && !this.config.heatmap)) {
            d3.select('#small_dataviz_container').selectAll('*').remove();
            document.getElementById('small_dataviz_wrapper')!.style.display = 'none';
            document.getElementById('small_dataviz_container')!.style.height =
                (0) + 'px';
            d3.select('#dataviz_container').selectAll('*').remove();
            document.getElementById('dataviz_wrapper')!.style.display = 'none';
            document.getElementById('dataviz_container')!.style.width =
                (0) + 'px';
            return;
        } else if (wantedInteractions.length == 0 || this.geoPainter.selectedEdge.length == 0) {
            d3.select('#small_dataviz_container').selectAll('*').remove();
            document.getElementById('small_dataviz_wrapper')!.style.display = 'none';
            document.getElementById('small_dataviz_container')!.style.height =
                (0) + 'px';
        } else if (this.geoPainter.selectedEdge.length < 2 && !this.config.channels_heatmap) {
            d3.select('#dataviz_container').selectAll('*').remove();
            document.getElementById('dataviz_wrapper')!.style.display = 'none';
            document.getElementById('dataviz_container')!.style.width =
                (0) + 'px';
        }

        if ((this.geoPainter.selectedEdge == undefined ||
            this.geoPainter.selectedEdge.length === 0) && !this.config.channels_heatmap) {
            return;
        }
        this.gui!.disabled = true;
// For each edge selected draw the histogram:
        const intensitiesToDraw = new Map<number, {
            [key: string]: { [key: string]: number[] }
        }[]>();
        const intensitiesToDrawChannel = new Map<number, {
            [key: string]: { [key: string]: number[] }
        }[]>();

        for (let i = 0; i < this.geoPainter.selectedEdge.length; i++) {
            if (!this.config.heatmap && wantedInteractions.length > 0) {
                const response = await fetch('intensity?' +
                    new URLSearchParams({
                        id: `${this.geoPainter.selectedEdge[i]}`,
                        radius: `${this.config.radius}`,
                        channels: wantedInteractions.join(','),
                        thresholds: thresholds.join(','),
                        shape: `${this.config.shape}`,
                    })).then((response) => response.json());
                intensitiesToDraw.set(this.geoPainter.selectedEdge[i],
                    response);
                if (!this.config.channels_heatmap) {
                    intensitiesToDrawChannel.set(this.geoPainter.selectedEdge[i],
                        response);
                }
            } else {
                if (this.config.heatmap && !interactionsChanged && !channelsHeatMapActivated) {
                    intensitiesToDraw.set(this.geoPainter.selectedEdge[i],
                        await fetch('intensity?' +
                            new URLSearchParams({
                                id: `${this.geoPainter.selectedEdge[i]}`,
                                radius: `${this.config.radius}`,
                                channels: Object.keys(this.config.interactions)
                                    .filter((d) => d !== 'centers ').join(','),
                                thresholds: allThresholds.join(','),
                                shape: `${this.config.shape}`,
                            })).then((response) => response.json()));
                }
                if (!this.config.channels_heatmap && wantedInteractions.length > 0) {
                    const response = await fetch('intensity?' +
                        new URLSearchParams({
                            id: `${this.geoPainter.selectedEdge[i]}`,
                            radius: `${this.config.radius}`,
                            channels: wantedInteractions.join(','),
                            thresholds: thresholds.join(','),
                            shape: `${this.config.shape}`,
                        })).then((response) => response.json());
                    intensitiesToDrawChannel.set(this.geoPainter.selectedEdge[i],
                        response);
                }
            }
        }
        if (this.config.channels_heatmap && interactionsChanged || channelsHeatMapActivated) {
            const response = await fetch('intensity/all?' +
                new URLSearchParams({
                    radius: `${this.config.radius}`,
                    channels: wantedInteractions.join(','),
                    thresholds: thresholds.join(','),
                    shape: `${this.config.shape}`,
                })).then((response) => response.json());
            let i = 1;
            // eslint-disable-next-line guard-for-in
            for (const key in response) {
                const obj = response[key];
                // @ts-ignore
                intensitiesToDrawChannel.set(i, {[i.toString()]: obj});
                i++;
            }
        }


        if (this.config.heatmap && this.config.interactions_visible && !interactionsChanged && !channelsHeatMapActivated) {
            document.getElementById('small_dataviz_wrapper')!.style.display = 'block';
            this.vizard.paintHeatmap(intensitiesToDraw, this.geoPainter, 50.0, this);
        } else if (this.config.interactions_visible) {
            document.getElementById('small_dataviz_wrapper')!.style.display = 'block';
            this.vizard.drawInteractionView(intensitiesToDraw, this.geoPainter, this);
        } else {
            document.getElementById('small_dataviz_wrapper')!.style.display = 'none';
        }


// Draw the comparison view if there are more then two edges selected
        if (intensitiesToDrawChannel.size > 1 && this.config.channels_visible && !this.config.channels_heatmap) {
            this.vizard.drawComparisonView(intensitiesToDrawChannel, this.geoPainter, this);
        } else if (intensitiesToDrawChannel.size == 1 && this.config.channels_visible && !this.config.channels_heatmap) {
            d3.select('#dataviz_container').selectAll('*').remove();
            document.getElementById('dataviz_wrapper')!.style.display = 'none';
            document.getElementById('dataviz_container')!.style.width =
                (0) + 'px';
        } else if (this.config.channels_heatmap &&
            this.config.channels_visible && interactionsChanged || channelsHeatMapActivated) {
            this.vizard.drawComparisonView(intensitiesToDrawChannel, this.geoPainter, this, true);
        } else if (!this.config.channels_visible) {
            d3.select('#dataviz_container').selectAll('*').remove();
            document.getElementById('dataviz_wrapper')!.style.display = 'none';
            document.getElementById('dataviz_container')!.style.width =
                (0) + 'px';
        }
        this.gui!.disabled = false;
    }

    public async getIntensitiesCsv() {
        const wantedInteractions = [];
        const thresholds = [];
        for (const key in this.config.interactions) {
            if (this.config.interactions[key]) {
                wantedInteractions.push(key);
                thresholds.push(this.config.channelSettings[key].threshold);
            }
        }
        if (wantedInteractions.length == 0) {
            return;
        }
        if (!this.geoPainter.selectedEdge) {
            return;
        }
        const intensitiesCsv = await fetch('intensity/csv?' +
            new URLSearchParams({
                id: `${this.geoPainter.selectedEdge}`,
                radius: `${this.config.radius}`,
                channels: wantedInteractions.join(','),
                thresholds: thresholds.join(','),
                shape: `${this.config.shape}`,
            }));

        const blob = await intensitiesCsv.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'intensities.csv';
        a.click();
        window.URL.revokeObjectURL(url);
    }

    public async prepareAllIntensities() {
        const wantedInteractions = [];
        const thresholds = [];
        for (const key in this.config.interactions) {
            if (this.config.interactions[key]) {
                wantedInteractions.push(key);
                thresholds.push(this.config.channelSettings[key].threshold);
            }
        }
        if (wantedInteractions.length == 0) {
            return;
        }
        const interactions = await fetch('intensity/all?' +
            new URLSearchParams({
                radius: `${this.config.radius}`,
                channels: wantedInteractions.join(','),
                thresholds: thresholds.join(','),
                shape: `${this.config.shape}`,
            })).then((response) => response.json());
        await this.vizard.drawInteractionView(interactions, this.geoPainter, this);
        const scene = this.geometricScene;
        const edgeColor = this.geoPainter.edgeColor;
        const app = this;
        d3.selectAll('rect').each(function (d, i) {
            // eslint-disable-next-line no-invalid-this
            const rect = d3.select(this);
            rect.on('click', function () {
                const selectedEdge = parseInt(rect.attr('id'));
                selectEdge(scene, edgeColor, [selectedEdge], app.config.wireframe);
                app.geoPainter.selectedEdge = [selectedEdge];
                app.getIntensities();
                d3.selectAll('rect').each(function (d, i) {
                    // eslint-disable-next-line no-invalid-this
                    const rect2 = d3.select(this);
                    rect2.style('stroke', 'none');
                });
                rect.style('stroke', 'yellow');
            });
        });
        document.getElementById('loading_text')!.style.display = 'none';
        return;
    }

    public startEditingMode() {
        if (this.mode == Mode.Analysis) {
            console.log('Graph Editing Mode');

            document.getElementById('dataviz_button')!.style.display = 'none';
            document.getElementById('dataviz_wrapper')!.style.display = 'none';
            document.getElementById('small_dataviz_wrapper')!.style.display = 'none';
            document.getElementById('polarization_dataviz_wrapper')!.style.display = 'none';

            // const canvas = document.getElementById('canvas')!;
            // canvas.style.left = '20%';
            // canvas.style.width = '60%';
            this.mode = Mode.Editing;
            const sliceBox = document.getElementById('slice_view_box')!;
            sliceBox.style.display = 'grid';
            this.editingSphere?.position.set(0, 0, 0);
            addCenterLinesSliceView();

            document.addEventListener(
                'keydown', this.editingEventListener.bind(this), false);
        } else {
            console.log('Analysis Mode');
            document.removeEventListener(
                'keydown', this.editingEventListener.bind(this), false);
            // const canvas = document.getElementById('canvas')!;
            // canvas.style.left = '0%';
            // canvas.style.width = '100%';
            this.mode = Mode.Analysis;
            const sliceBox = document.getElementById('slice_view_box')!;
            sliceBox.style.display = 'none';
            this.geometricScene.remove(this.editingSphere!);
            this.geoPainter.editCenters();
        }
    }

    public editingEventListener(event: KeyboardEvent) {
        if (!this.editingSphere) {
            return;
        }

        if (event.key === 'w') {
            this.editingSphere!.position.y += 5;
        } else if (event.key === 's') {
            this.editingSphere!.position.y -= 5;
        } else if (event.key === 'a') {
            this.editingSphere!.position.x -= 5;
        } else if (event.key === 'd') {
            this.editingSphere!.position.x += 5;
        } else if (event.key === 'q') {
            this.editingSphere!.position.z -= 5;
        } else if (event.key === 'e') {
            this.editingSphere!.position.z += 5;
        }

        updateSliceViewPos(this.clippingPlane, this.editingSphere!,
            this.volumePainter.volumeSize!);

        if (event.key === 'c') {
            const newCenter: number[] = [];
            this.editingSphere!.position.toArray(newCenter).reverse();
            this.geoPainter.newCenters.push(newCenter);
        }

        if (event.key == 'Delete' || event.key == 'Backspace') {
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(this.mousePos, this.camera);
            const intersects = raycaster.intersectObjects(
                this.geometricScene.children).filter((obj) =>
                obj.object.type == 'vertex');
            if (intersects.length > 0) {
                this.geometricScene.remove(intersects[0].object);
                const pos = intersects[0].object.position;
                this.geoPainter.deleteCenters.push([pos.z, pos.y, pos.x]);
            }
        }
    }

    public async getPolarization() {
        if (!this.geoPainter.torusOn) {
            return;
        }
        const wantedInteractions = [];
        const thresholds = [];
        this.geometricScene.children
            .filter((child: any) => {
                return child.type === 'torus' || child.type === 'wire';
            }).forEach((child) => {
            this.geometricScene.remove(child);
        });
        for (const key in this.config.interactions) {
            if (this.config.interactions[key] && !key.startsWith('DNA')) {
                wantedInteractions.push(key);
                thresholds.push(this.config.channelSettings[key].threshold);
            }
        }
        if (wantedInteractions.length == 0) {
            return;
        }
        if (this.geoPainter.selectedEdge.length == 0) {
            return;
        }

        this.gui!.disabled = true;

        this.geometricScene.children
            .filter((child: any) => {
                return child.type === 'torus';
            }).forEach((child) => {
            this.geometricScene.remove(child);
        });

        const polarizationHeatmapData = new Map<string, object[]>();
        if (this.config.polarization_heatmap) {
            const allInteractions = Object.keys(this.config.interactions).filter((d) => !d.startsWith('DNA'));
            for (let i = 0; i < allInteractions.length; i++) {
                const torusData = await fetch('polarization?' + new URLSearchParams({
                    radius: this.config.radius.toString(),
                    channel: allInteractions[i],
                    threshold: this.config.allThresholds[i].toString(),
                    edge_ids: this.geoPainter.selectedEdge.toString(),
                }))
                    .then((response) => response.json())
                    .catch((error) => console.error(error));

                if (wantedInteractions.includes(allInteractions[i])) {
                    const color = this.config.channelSettings[allInteractions[i]].color;
                    this.geoPainter.addToruses(torusData,
                        wantedInteractions.indexOf(allInteractions[i]), allInteractions[i], new THREE.Color(color));
                }

                for (let j = 0; j < torusData[0].length; j++) {
                    const node = torusData[0][j].toString();
                    const polarization = torusData[1][j] as number[];
                    const channel = allInteractions[i];
                    if (!polarizationHeatmapData.has(node)) {
                        polarizationHeatmapData.set(node, []);
                    }
                    polarization.forEach((value, x) => polarizationHeatmapData.get(node)?.push({
                        variable: channel,
                        group: (x / (polarization.length)),
                        value: value,
                    }));
                }
            }
            document.getElementById('polarization_dataviz_wrapper')!.style.display = 'block';
            this.vizard.paintPolarizationHeatmap(polarizationHeatmapData);
        } else {
            for (let i = 0; i < wantedInteractions.length; i++) {
                const torusData = await fetch('polarization?' + new URLSearchParams({
                    radius: this.config.radius.toString(),
                    channel: wantedInteractions[i],
                    threshold: thresholds[i].toString(),
                    edge_ids: this.geoPainter.selectedEdge.toString(),
                }))
                    .then((response) => response.json())
                    .catch((error) => console.error(error));
                const color = this.config.channelSettings[wantedInteractions[i]].color;
                this.geoPainter.addToruses(torusData, i, wantedInteractions[i], new THREE.Color(color));
            }
        }
        this.gui!.disabled = false;
    }
}

export interface ChannelConfig {
    clim1: number;
    clim2: number;
    renderstyle: string;
    threshold: number;
    opacity: number;
    color: string;
}

export interface Config extends ChannelConfig {
    channelSettings: { [key: string]: ChannelConfig };
    channels: { [key: string]: boolean };
    interactions: { [key: string]: boolean };
    radius: number;
    polarizationRadius: number;
    channel: string;
    shape: string;
    prepare: boolean;
    heatmap: boolean;
    interactions_visible: boolean;
    channels_visible: boolean;
    channels_heatmap: boolean;
    polarization_heatmap: boolean;
    thresholds: number[];
    allThresholds: number[];
    wantedInteractions: string[];
    wireframe: boolean;
}

interface myGui extends Pane {
    analysisTabs: TabApi;
    channelDropdown: InputBindingApi<unknown, string>;
    channelSettings: FolderApi;
}

new App().start();
