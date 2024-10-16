import * as THREE from 'three';
import {LineBasicMaterial, Mesh, Vector3} from 'three';
import {Config} from './app';
import {selectEdge} from './util';

export class GeoPainter {
  public scene: THREE.Scene;
  public config: Config;
  public sphereRadius: number;
  public sphereColor: THREE.Color;
  public edgeColor: THREE.Color;
  public addingEdges: boolean;
  public allEdges: number[];
  public selectedEdge: number[]; // Array holding the selected edges the user would like to analyse
  public newCenters: number[][];
  public deleteCenters: number[][];
  public camera: THREE.Camera;
  public torusOn: boolean;
  public torusCenters: number[][];

  constructor(scene: THREE.Scene, config: Config, camera: THREE.Camera) {
    this.scene = scene;
    this.config = config;
    this.sphereRadius = 3.0;
    this.sphereColor = new THREE.Color('white');
    this.edgeColor = new THREE.Color('white');
    this.addingEdges = false;
    this.selectedEdge = [];
    this.allEdges = [];
    this.newCenters = [];
    this.deleteCenters = [];
    this.camera = camera;
    this.torusOn = false;
    this.torusCenters = [];
  }

  public paintSphere(
      position: THREE.Vector3, radius: number, color: THREE.Color, visible = true, id = -1,
      start = new Vector3(0, 0, 0), end = new Vector3(0, 0, 0), cellType: string = 'other'): Mesh {
    const colorScale : number = ((position.z + 20) / 50) * 0.5 + 0.5;
    color.setRGB(colorScale, colorScale, colorScale);
    const geometry = new THREE.SphereGeometry(radius, 32, 16);
    const material = new THREE.MeshBasicMaterial({color: color});
    const sphere = new CustomSphere(geometry, material, id, start, end);
    sphere.translateX(position.x);
    sphere.translateY(position.y);
    sphere.translateZ(position.z);
    sphere.type = 'vertex';
    sphere.cellType = cellType;
    sphere.visible = visible;
    this.scene.add(sphere);
    return sphere;
  }

  public paintBox(
      position: THREE.Vector3, size: number, color: THREE.Color, visible = true, id = -1,
      cellType: string = 'other'): Mesh {
    const colorScale : number = ((position.z + 20) / 50) * 0.5 + 0.5;
    color.setRGB(colorScale, colorScale, colorScale);
    const geometry = new THREE.BoxGeometry(size*2, size*2, size*2);
    const material = new THREE.MeshBasicMaterial({color: color});
    const box = new CustomBox(geometry, material);
    box.translateX(position.x);
    box.translateY(position.y);
    box.translateZ(position.z);
    box.type = 'vertex';
    box.cellType = cellType;
    box.edgeId = id;
    box.visible = visible;
    this.scene.add(box);
    return box;
  }

  public paintPyramid(
      position: THREE.Vector3, size: number, color: THREE.Color, visible = true, id = -1,
      cellType: string = 'other'): Mesh {
    const colorScale : number = ((position.z + 20) / 50) * 0.5 + 0.5;
    color.setRGB(colorScale, colorScale, colorScale);
    const geometry = new THREE.ConeGeometry(30, 40, 10);
    const material = new THREE.MeshBasicMaterial({color: color});
    const pyramid = new CustomPyramid(geometry, material);
    pyramid.translateX(position.x);
    pyramid.translateY(position.y);
    pyramid.translateZ(position.z);
    pyramid.type = 'vertex';
    pyramid.cellType = cellType;
    pyramid.edgeId = id;
    pyramid.visible = visible;
    this.scene.add(pyramid);
    return pyramid;
  }

  public paintLine(
      start: THREE.Vector3, end: THREE.Vector3,
      color: THREE.Color, id: number, radius: number, shape: string): void {
    const points = [];
    this.allEdges.push(id);
    points.push(start, end);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({color: color});
    const line = new CustomLine(geometry, material, id, radius, shape);
    line.type = 'edge';
    this.scene.add(line);
  }

  public paintCone(
      start: THREE.Vector3, end: THREE.Vector3,
      id: number, color: THREE.Color, radius: number) {
    if (this.config.shape === 'cylinder') {
      const distance = start.distanceTo(end) / 2;
      const geometry = new THREE.CylinderGeometry(radius, radius, distance, 7, 1);

      const material = new THREE.LineBasicMaterial({color: 'yellow'});

      geometry.translate(0, distance * 1.5, 0);
      geometry.rotateX(Math.PI * 0.5);

      const wireframe = new THREE.WireframeGeometry(geometry);
      material.depthTest = true;
      material.opacity = 1.0;
      material.transparent = true;
      const cone = new CustomLineSegments(wireframe, material,
          id, radius, 'cone');
      cone.type = 'cone';
      cone.edgeId = id;
      wireframe.type = 'cone';
      cone.visible = false;
      cone.position.copy(start);
      cone.lookAt(end);
      this.scene.add(cone);
    } else {
      const distance = start.distanceTo(end) / 2;
      const geometry = new THREE.ConeGeometry(radius, distance, 16);
      const material = new THREE.LineBasicMaterial({color: 'yellow'});

      geometry.translate(0, distance * 1.5, 0);
      geometry.rotateX(Math.PI * 0.5);

      const wireframe = new THREE.WireframeGeometry(geometry);
      material.depthTest = true;
      material.opacity = 1.0;
      material.transparent = true;
      const cone = new CustomLineSegments(wireframe, material,
          id, radius, 'cone');
      cone.type = 'cone';
      cone.edgeId = id;
      wireframe.type = 'cone';
      cone.visible = false;
      cone.position.copy(start);
      cone.lookAt(end);
      this.scene.add(cone);
    }
  }

  public paintTorus(
      position: THREE.Vector3, radius: number,
      color: THREE.Color, arcStart: number, arc: number,
      channel: string, tube: number, vertexId: string) {
    const geometry = new THREE.TorusGeometry(radius, tube*2,
        20, 100, arc*2*Math.PI-0.1);
    const material = new THREE.MeshBasicMaterial({color: color});
    const torus : any = new THREE.Mesh(geometry, material);


    torus.translateX(position.x);
    torus.translateY(position.y);
    torus.translateZ(position.z);
    torus.lookAt(this.camera.position);
    torus.rotateZ(Math.PI*2*arcStart);

    torus.type = 'torus';
    torus.vertexId = parseInt(vertexId);
    torus.channel = channel;
    console.log(torus);
    this.scene.add(torus);

    /**
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 'black',
    });

    const offset = 4.0;
    const startPointX = position.x + offset * Math.cos(Math.PI * 2 * arcStart);
    const startPointY = position.y + offset * Math.sin(Math.PI * 2 * arcStart);
    const endPointX = position.x + (radius + tube) * Math.cos(Math.PI * 2 * arcStart);
    const endPointY = position.y + (radius + tube) * Math.sin(Math.PI * 2 * arcStart);

    const points = [];
    points.push(new THREE.Vector3(startPointX, startPointY, 10));
    points.push(new THREE.Vector3(endPointX, endPointY, 10));

    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);

    const line = new THREE.Line(lineGeometry, lineMaterial);
    line.type = 'torus';
    this.scene.add(line);
    */
  }

  public async addToruses(torusData: [number[][], number[][], string[]], orbit: number,
      channel: string, color: THREE.Color): Promise<void> {
    // const oldTorus = this.scene.children.filter((child) => child.type === 'torus');
    // oldTorus.forEach((child) => {
    //  this.scene.remove(child);
    // });
    const centers = torusData[0];
    this.torusCenters = centers;
    const regionData = torusData[1];
    for (let i=0; i<centers.length; i++) {
      const center = new THREE.Vector3(centers[i][0], centers[i][1], centers[i][2]);
      const arcs = regionData[i];
      for (let j=0; j<arcs.length; j+=1) {
        this.paintTorus(center, ((orbit*4)+7+arcs[j]), color, (j/12)+0.5, 1/12, channel, arcs[j], torusData[2][i]);
      }
    }
  }

  public drawTorusSpheres(): void {
    this.scene.children
        .filter((child: any) => {
          return child.type === 'wire';
        }).forEach((child) => {
          this.scene.remove(child);
        });
    for (let i=0; i<this.torusCenters.length; i++) {
      const center = this.torusCenters[i];
      const sphereGeometry = new THREE.SphereGeometry(this.config.polarizationRadius, 4, 4);
      const sphereMaterial = new THREE.MeshBasicMaterial({
        color: 0xFFFF00,
        wireframe: true,
        visible: true,
      });
      const sphere = new CustomSphere(sphereGeometry, sphereMaterial, -1, new Vector3(0, 0, 0), new Vector3(0, 0, 0));
      sphere.type = 'wire';
      sphere.translateX(center[0]);
      sphere.translateY(center[1]);
      sphere.translateZ(center[2]);
      this.scene.add(sphere);
    }
  }

  public buildGraph(): void {
    const children = this.scene.children
        .filter((child) => child.type === 'vertex' ||
                child.type === 'edge' || child.type === 'cone');
    children.forEach((child) => {
      this.scene.remove(child);
    });

    Promise.all([
      fetch('http://localhost:8080/vertices'),
      fetch('http://localhost:8080/edges'),
    ]).then((responses) => {
      return Promise.all(responses.map(function(response) {
        return response.json();
      }));
    }).then(([vertices, edges]) => {
      (vertices as Vertex[]).forEach((vertex) => {
        /*
        if (vertex.cellType == 2) {
          this.paintSphere(
              new THREE.Vector3(vertex.x, vertex.y, vertex.z),
              this.sphereRadius, this.sphereColor, true, vertex.id,
              new Vector3(0, 0, 0), new Vector3(0, 0, 0), 'other');
        } else if (vertex.cellType == 1) {
          this.paintSphere(
              new THREE.Vector3(vertex.x, vertex.y, vertex.z),
              this.sphereRadius, this.sphereColor, true, vertex.id,
              new Vector3(0, 0, 0), new Vector3(0, 0, 0), 'other');

          const box = this.paintBox( new THREE.Vector3(vertex.x, vertex.y, vertex.z),
              this.sphereRadius, this.sphereColor, true, vertex.id,
              'tumor');
          box.rotateZ(Math.PI/4);

        } else {
          */
        this.paintSphere(
            new THREE.Vector3(vertex.x, vertex.y, vertex.z),
            this.sphereRadius, this.sphereColor, true, vertex.id,
            new Vector3(0, 0, 0), new Vector3(0, 0, 0), 'other');
        // }
      });
      (edges as Edge[]).forEach((edge) => {
        const start = vertices[edge.start];
        const end = vertices[edge.end];
        this.paintLine(
            new THREE.Vector3(start.x, start.y, start.z),
            new THREE.Vector3(end.x, end.y, end.z),
            this.edgeColor, edge.id, this.config.radius, this.config.shape);
        this.paintCone(
            new THREE.Vector3(start.x, start.y, start.z),
            new THREE.Vector3(end.x, end.y, end.z),
            edge.id, this.edgeColor, this.config.radius);
        this.paintCone(
            new THREE.Vector3(end.x, end.y, end.z), new
            THREE.Vector3(start.x, start.y, start.z),
            edge.id, this.edgeColor, this.config.radius);

        const point = new THREE.Vector3(((end.x - start.x) / 2) + start.x,
            ((end.y - start.y) / 2) + start.y,
            ((end.z - start.z) / 2) + start.z);
        const annotationSphereMaterial : any = this.paintSphere(
            new THREE.Vector3(point.x, point.y, point.z),
            this.sphereRadius*2, new THREE.Color('red'), false, edge.id, start, end).material;
        annotationSphereMaterial.color = new THREE.Color('red');
      });
      if (this.selectedEdge != undefined) {
        selectEdge(this.scene, this.edgeColor, this.selectedEdge, this.config.wireframe);
      }
    }).catch(function(error) {
      console.log(error);
    });
  }

  public async editCenters(): Promise<void> {
    if (this.newCenters.length+this.deleteCenters.length == 0) {
      return Promise.resolve();
    }
    await fetch('http://localhost:8080/vertices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([this.newCenters, this.deleteCenters]),
    })
        .then((response) => {
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          return response.json();
        })
        .catch((error) => {
          console.error('There was a problem with the fetch operation:', error);
        }).then(() => {
          this.newCenters = [];
          this.deleteCenters = [];
        }).then(() => {
          this.buildGraph();
        });
    return;
  }
}

interface Vertex {
    x: number;
    y: number;
    z: number;
    cellType?: number;
    id?: number;
}

interface Edge {
    id: number,
    start: number;
    end: number;
}

export class CustomSphere extends THREE.Mesh {
  public edgeId: number;
  public start: Vertex;
  public end: Vertex;
  public cellType?: string;

  constructor(geometry: THREE.SphereGeometry, material: THREE.MeshBasicMaterial,
      edgeId: number, start: Vertex, end: Vertex) {
    super(geometry, material);
    this.edgeId = edgeId;
    this.start = start;
    this.end = end;
  }
}

export class CustomBox extends THREE.Mesh {
  public cellType?: string;
  public edgeId?: number;
}

export class CustomPyramid extends THREE.Mesh {
  public cellType?: string;
  public edgeId?: number;
}

export class CustomLine extends THREE.Line {
  public edgeId: number;
  public radius: number;
  public shape: string;

  constructor(
      geometry: THREE.BufferGeometry, material: LineBasicMaterial,
      edgeId: number, radius: number, shape: string) {
    super(geometry, material);
    this.edgeId = edgeId;
    this.radius = radius;
    this.shape = shape;
  }
}

export class CustomLineSegments extends THREE.LineSegments {
  public edgeId: number;
  public radius: number;
  public shape: string;

  constructor(
      geometry: THREE.WireframeGeometry, material: LineBasicMaterial,
      edgeId: number, radius: number, shape: string) {
    super(geometry, material);
    this.edgeId = edgeId;
    this.radius = radius;
    this.shape = shape;
  }
}
