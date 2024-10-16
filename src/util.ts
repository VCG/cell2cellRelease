import * as THREE from 'three';
import {GeoPainter, CustomLine, CustomLineSegments} from './geo_painter';
import {App, Config} from './app';
import * as d3 from 'd3';
import {highlightAllLinesAndConesWithId} from './vis';
import {Color} from 'three';

let dehighlight = false;

// Handles the interaction with the scene graph and
// the Graph editing functionality
export function onDocumentMouseOver(event: MouseEvent, geoPainter: GeoPainter,
    geometricScene: THREE.Scene, finalScene: THREE.Scene,
    camera: THREE.Camera, app: App) {
  event.preventDefault();
  const canvas = document.getElementById('canvas')!;
  const mouse3D = new THREE.Vector3(
      (event.clientX / canvas.clientWidth) * 2 - 1,
      -(event.clientY / canvas.clientHeight) * 2 + 1, 0.5);


  app.mousePos = mouse3D;
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse3D, camera);
  if (app.mode == Mode.Analysis) {
    // Selecting edge for analysis
    const intersects =
            raycaster.intersectObjects(geometricScene.children)
                .filter((intersect) => intersect.object.type === 'cone' ||
                    intersect.object.type === 'edge');
    if (intersects.length == 0) {
      // DEHIGHLIGH IF NECCESSARY
      if (dehighlight) {
        highlightAllLinesAndConesWithId('-1', 1.5,
            geoPainter, new Color(1, 1, 0));
        dehighlight = false;
      }
      return;
    }
    const iObject = intersects[0].object as CustomLineSegments | CustomLine;
    highlightAllLinesAndConesWithId(iObject.edgeId.toString(), 6.0,
        geoPainter, new Color(1, 0, 0));
    dehighlight = true;
  }
}

// Handles the interaction with the scene graph and
// the Graph editing functionality
export function onDocumentMouseDown(event: MouseEvent, geoPainter: GeoPainter,
    geometricScene: THREE.Scene, finalScene: THREE.Scene,
    camera: THREE.Camera, app: App, sliceScene: THREE.Scene) {
  event.preventDefault();
  const canvas = document.getElementById('canvas')!;
  const mouse3D = new THREE.Vector3(
      (event.clientX / canvas.clientWidth) * 2 - 1,
      -(event.clientY / canvas.clientHeight) * 2 + 1, 0.5);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse3D, camera);
  if (app.mode == Mode.Analysis) {
    // Selecting edge for analysis
    const intersects =
            raycaster.intersectObjects(geometricScene.children)
                .filter((intersect) => intersect.object.type === 'edge' ||
                    intersect.object.type === 'cone');
    if (intersects.length == 0) {
      return;
    }
    const iObject = intersects[0].object as CustomLineSegments | CustomLine;
    const edgeID: number = Number(iObject.edgeId)
    if (geoPainter.addingEdges) {
            geoPainter.selectedEdge.indexOf(edgeID) === -1 ?
                geoPainter.selectedEdge.push(edgeID) :
                geoPainter.selectedEdge = geoPainter.selectedEdge
                    .filter((obj) => obj !== edgeID);
    } else {
      geoPainter.selectedEdge = [];
      geoPainter.selectedEdge.push(edgeID);
    }
    selectEdge(geometricScene, geoPainter.edgeColor, geoPainter.selectedEdge, geoPainter.config.wireframe);
    app.getIntensities();
  } else {
    editingMouseDown(raycaster, app, geoPainter, geometricScene,
        finalScene, sliceScene);
  }
}

function editingMouseDown(raycaster: THREE.Raycaster, app: App,
    geoPainter: GeoPainter, geometricScene: THREE.Scene,
    finalScene: THREE.Scene, sliceScene: THREE.Scene) {
  const intersects =
        raycaster.intersectObjects(finalScene.children)
            .filter((intersect) => intersect.object.type === 'volume');
  if (intersects.length == 0) {
    return;
  }
  const intersection = intersects[0];
  const intersectPoint = intersection.point;
  if (app.editingSphere) {
    geometricScene.remove(app.editingSphere);
  }

  const sphere = geoPainter.paintSphere(intersectPoint,
      geoPainter.sphereRadius, new THREE.Color('white'), true, -1);
  app.editingSphere = sphere;
    app.editingSphere!.material =
        new THREE.MeshBasicMaterial({color: 'yellow'});
    updateSliceViewPos(app.clippingPlane, app.editingSphere,
        app.volumePainter.volumeSize!);
}


export async function fetchImage(
    dim: string, x: number, y: number, z: number, channel: string) {
  // eslint-disable-next-line max-len
  const url = `http://localhost:8080/slice/${dim}?x=${x.toString()}&y=${y.toString()}&z=${z.toString()}&channel=${channel}`;

  const options = {
    method: 'GET',
  };

  const response = await fetch(url, options);

  const data = await response.json();
  const bytestring = data['status'];
  const rawImage = bytestring.split('\'')[1];

  const image = document.createElement('img');

  image.className = 'slice_view';
  image.classList.add(dim);
  image.src = 'data:image/jpeg;base64,' + rawImage;

  const container = document.getElementById('slice_view_box')!;
  for (let i = 0; i < container.children.length; i++) {
    const child = container.children[i];
    if (child.classList.contains(dim)) {
      container.removeChild(child);
    }
  }
  container.append(image);
}

export function onKeyDown(geoPainter: GeoPainter, event: KeyboardEvent) {
  if (event.key === 'Control') {
    geoPainter.addingEdges = true;
  }
}

export function onKeyUp(geoPainter: GeoPainter, event: KeyboardEvent,
    geometricScene: THREE.Scene, app: App) {
  if (event.key === 'Control') {
    // User Pressed Strg key
    console.log('AddingMode false');
    geoPainter.addingEdges = false;
  } else if (event.key === 'Escape') {
    geoPainter.addingEdges = false;
    geoPainter.selectedEdge = [];
    geometricScene.children
        .filter((child: any) => {
          return child.type === 'torus';
        }).forEach((child) => {
          geometricScene.remove(child);
        });
    selectEdge(geometricScene, geoPainter.edgeColor, geoPainter.selectedEdge, geoPainter.config.wireframe);
    // Hide the Dataviz
    app.getIntensities();
  }
}


// Highlight the selected edges the user would like to analyze
export function selectEdge(scene: THREE.Scene, edgeColor: THREE.Color,
    selectedEdges: number[], wireframe: boolean) {
  d3.select('svg').selectAll('*').remove();

  // console.log(selectedEdges)

  scene.children
      .filter((child) => child.type === 'edge' || child.type === 'cone')
      .forEach((child) => {
        const iChild = child as CustomLineSegments | CustomLine;
        const edgeID: number = Number(iChild.edgeId)
        const material = iChild.material as THREE.LineBasicMaterial;
        material.color.set(edgeColor);
        if (iChild.type === 'cone') {
          iChild.visible = false;
          material.color.set('white');
        }
        if (selectedEdges.includes(edgeID)) {
          // console.log("Edge " + edgeID +"  to Yellow")
          material.color.set('yellow');
          if (wireframe) {
            iChild.visible = true;
          }
        }
      });
}

export function backupSettings(globalConfig: Config, channel: string) {
  globalConfig.channelSettings[channel] = {
    clim1: globalConfig.clim1,
    clim2: globalConfig.clim2,
    renderstyle: globalConfig.renderstyle,
    threshold: globalConfig.threshold,
    opacity: globalConfig.opacity,
    color: globalConfig.color,
  };
}

export function restoreSettings(globalConfig: Config, channel: string) {
  globalConfig.clim1 = globalConfig.channelSettings[channel].clim1;
  globalConfig.clim2 = globalConfig.channelSettings[channel].clim2;
  globalConfig.renderstyle = globalConfig.channelSettings[channel].renderstyle;
  globalConfig.threshold = globalConfig.channelSettings[channel].threshold;
  globalConfig.opacity = globalConfig.channelSettings[channel].opacity;
  globalConfig.color = globalConfig.channelSettings[channel].color;
}

export function resizeCanvasToDisplaySize(renderer: THREE.WebGLRenderer,
    camera: THREE.Camera, renderTarget: THREE.WebGLRenderTarget) {
  const canvas = renderer.domElement;
  // look up the size the canvas is being displayed
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  // adjust displayBuffer size to match
  if (canvas.width !== width || canvas.height !== height) {
    // you must pass false here or three.js sadly fights the browser
    renderer.setSize(width, height, false);
    (camera as any).aspect = width / height;
    (camera as any).updateProjectionMatrix();

    // update any render target sizes here
    renderTarget.setSize(width, height);
  }
}

export const Mode = {
  Analysis: 0,
  Editing: 1,
};

export function updateSliceViewPos(clippingPlane: THREE.Vector3,
    editingSphere: THREE.Mesh, volumeSize: THREE.Vector3) {
  const x = editingSphere!.position.x;
  const y = editingSphere!.position.y;
  const z = editingSphere!.position.z;


  clippingPlane.x = x / volumeSize!.x;
  clippingPlane.y = y / volumeSize!.y;
  clippingPlane.z = z / volumeSize!.z;
}

export function addCenterLinesSliceView() {
  const canvas = <HTMLCanvasElement>document.getElementById('overlay');
  const ctx = canvas!.getContext('2d')!;


  let x = canvas.width / 2;
  let y = canvas.height / 2;

  x = Math.floor(x) + 0.5;
  y = Math.floor(y) + 0.5;

  ctx.moveTo(x, y - 200);
  ctx.lineTo(x, y + 200);

  ctx.moveTo(x - 200, y);
  ctx.lineTo(x + 200, y);

  ctx.strokeStyle = 'yellow';
  ctx.lineWidth = 0.5;

  ctx.stroke();
}
