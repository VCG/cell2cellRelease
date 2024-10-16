/* eslint-disable no-invalid-this */
import * as d3 from 'd3';
import {Config} from './app';
import {CustomLineSegments, CustomSphere, GeoPainter} from './geo_painter';
import {App} from './app';
import {Color} from 'three';
import * as THREE from 'three';
import {selectEdge} from "./util";

// Build color scale
const myColor = d3.scaleSequential()
    .interpolator(d3.interpolateInferno)
    .domain([0, 1]);

export function highlightAllLinesAndConesWithId(id: string, size: number,
                                                geoPainter: GeoPainter, color: Color, relativePos = -1) {
    const paths = d3.select('#dataviz_container').selectAll('g').selectChildren('path').nodes()
        .concat(d3.select('#small_dataviz_container').selectAll('g').selectChildren('path').nodes());
    for (let i = 0; i < paths.length; i++) {
        const path = paths[i] as SVGPathElement;
        // console.log(path.getAttribute('id'))
        // @ts-ignore
        if (path.getAttribute('id') === id) {
            path.setAttribute('stroke-width', size.toString());
        } else {
            path.setAttribute('stroke-width', 1.5.toString());
        }
    }
    const cones = geoPainter.scene.children
        .filter((child) => (child.type === 'cone'));
    cones.forEach((cone) => {
        const iCone = cone as CustomLineSegments;
        if (id === iCone.edgeId.toString() && iCone.visible) {
            setTimeout(function () {
                // @ts-ignore
                iCone.material.color = color;
            }, 200);
        } else {
            // @ts-ignore
            iCone.material.color = new Color(1, 1, 0);
        }
    });


    // TODO Present a Sphere along the centerline
    const vertices = geoPainter.scene.children
        .filter((child) => (child.type === 'vertex'));
    vertices.forEach((vertex) => {
        const iSphere = vertex as CustomSphere;
        if (iSphere.edgeId !== -1 && id === iSphere.edgeId.toString()) {
            if (relativePos >= 0) {
                const start = iSphere.start;
                const end = iSphere.end;
                const point = new THREE.Vector3(((end.x - start.x) * relativePos) + start.x,
                    ((end.y - start.y) * relativePos) + start.y,
                    ((end.z - start.z) * relativePos) + start.z);
                iSphere.position.set(point.x, point.y, point.z);
                iSphere.visible = true;
            } else {
                setTimeout(function () {
                    iSphere.visible = false;
                }, 200);
            }
        }
    });
}

export class Vizard {
    static config: Config;

    constructor(config: Config) {
        Vizard.config = config;
    }

    private getDataToDraw(interactions: { [key: string]: { [key: string]: number[] } }, normalize = false) {
        const xs = [] as number[];
        const ys = [] as number[];
        const dataToDraw = new Map<string, number[][]>();
        Object.keys(interactions).forEach((key) => {
            const data = interactions[key];
            const coordsArray = [] as number[][];
            // @ts-ignore
            for (let i = 0; i < data.length; i++) {
                xs.push(i);
                // @ts-ignore
                ys.push(data[i]);
                if (!Array.isArray(data[i])) {
                    // @ts-ignore
                    normalize ? coordsArray.push([i / data.length, data[i]]) : coordsArray.push([i, data[i]]);
                } else {
                    // @ts-ignore
                    normalize ? coordsArray.push([data[i][0] / data.length, data[i][1]]) : coordsArray.push(data[i]);
                }
            }
            dataToDraw.set(key, coordsArray);
        });
        const xMax = normalize ? 1 : d3.max(xs) as number;
        const yMax = d3.max(ys) as number;
        return [dataToDraw, xMax, yMax];
    }

    private async drawHeatmap(selector: string, margin: { top: number, right: number, left: number, bottom: number },
                              height: number, width: number, geoPainter: GeoPainter, legendOffsetY: number,
                              legendOffsetX: number, dataToDraw: object[],
                              xMax: number, yMax: number, channel = '', title = '', id = -1, app: App) {
        const svg = d3.select(selector).append('g').attr('id', id)
            .attr('transform', 'translate(' +
                [margin.left, margin.bottom] + ')')
            .on('mouseover', function (d) {
                const boundingClientRect = this.getBoundingClientRect() as DOMRect;
                const relativeXPos = (d.clientX - boundingClientRect.x) / boundingClientRect.width;
                highlightAllLinesAndConesWithId(d3.select(this).attr('id').toString(),
                    6, geoPainter, new Color(1, 0, 0), relativeXPos);
            })
            .on('mouseout', function (d) {
                highlightAllLinesAndConesWithId(d3.select(this).attr('id').toString(),
                    1.5, geoPainter, new Color(1, 1, 0));
            });

        // @ts-ignore
        const myGroups = [...new Set(dataToDraw.map((d) => d.group))];

        // TODO Get the channel order from the webserver
        const myVars = await fetch('channels/rank?' +
            new URLSearchParams({
                id: `${id}`,
                radius: `${Vizard.config.radius}`,
                channels: Object.keys(Vizard.config.interactions)
                    .filter((d) => d !== 'centers ').join(','),
                thresholds: Vizard.config.allThresholds.join(','),
                shape: `${Vizard.config.shape}`,
            })).then((response) => response.json()) as string[];
        const clusters = await fetch('channels/clusters?' +
            new URLSearchParams({
                id: `${id}`,
                radius: `${Vizard.config.radius}`,
                channels: Object.keys(Vizard.config.interactions)
                    .filter((d) => d !== 'centers ').join(','),
                thresholds: Vizard.config.allThresholds.join(','),
                shape: `${Vizard.config.shape}`,
                cluster_threshold: '0.05',
            })).then((response) => response.json()) as string[];
        // console.log(clusters);
        // Build X scales and axis:
        // @ts-ignore
        const x = d3.scaleBand().range([0, width - 80]).domain(myGroups)
            .padding(0);

        // Build Y scales and axis:
        // @ts-ignore
        const y = d3.scaleBand().range([height, 0]).domain(myVars)
            .padding(0.0);
        svg.append('g')
            .style('font-size', 10)
            .attr('transform', 'translate(50,0)')
            .call(d3.axisLeft(y).tickSize(0))
            .select('.domain').remove();


        // add the squares
        // @ts-ignore
        const yGenerator = function (d) {
            return y(d.variable);
        };
        // @ts-ignore
        const xGenerator = function (d) {
            return x(d.group);
        };
        // @ts-ignore
        const rect = svg.selectAll()
            .data(dataToDraw)
            .enter()
            .append('rect')
            .attr('transform', 'translate(50,0)');
        // @ts-ignore
        rect.attr('x', xGenerator);
        // @ts-ignore
        rect.attr('y', yGenerator)
            .attr('rx', 0)
            .attr('ry', 0)
            .attr('width', x.bandwidth())
            .attr('height', y.bandwidth())
            .style('fill', function (d) {
                // @ts-ignore
                return myColor(d.value);
            })
            .style('stroke-width', 4)
            .style('stroke', 'none')
            .style('opacity', 0.8);
    }

    private drawGraph(selector: string, margin: { top: number, right: number, left: number, bottom: number },
                      height: number, width: number, geoPainter: GeoPainter, legendOffsetY: number,
                      legendOffsetX: number, dataToDraw: Map<string, number[][]>,
                      xMax: number, yMax: number, app: App, channel = '', title = '', id = -1, order = -1, initialMoveX = 0, initialMoveY = 0) {
        // console.log(dataToDraw)

        const svg = d3.select(selector).append('g').attr('transform',
            'translate(' + initialMoveY + ',' + initialMoveX + ')');
        if (id !== -1 && order !== -1) svg.attr('id', (id + '_' + order));
        const xScale = d3.scaleLinear().domain([0, xMax])
            .range([0, width - (title !== '' ? 100 : 130)]); // ADJUST WIDTH OF PLOT

        svg.append('g')
            .attr('transform', 'translate(' +
                [margin.left, height + margin.bottom] + ')')
            .call(d3.axisBottom(xScale));

        const yScale = d3.scaleLinear().domain([0, yMax]).range([height, 0]);

        svg.append('g')
            .attr('transform', 'translate(' +
                [margin.left, margin.bottom] + ')')
            .call(d3.axisLeft(yScale));

        let additionalOffsetY = 0;
        let additionalOffsetX = 0;
        // Title of the chart
        if (title !== '') {
            svg.append('text')
                .attr('x', legendOffsetX + width - 77)
                .attr('y', 12)
                .text(title)
                .attr('channel', title.trim())
                .attr('font-family', 'Roboto Mono, Source Code Pro, Menlo, Courier, monospace')
                .style('fill', Vizard.config.channelSettings[channel] !== undefined ?
                    Vizard.config.channelSettings[channel].color : '#ffffff');
            additionalOffsetY = 15;
            additionalOffsetX = 10;
        } else {
            additionalOffsetX = -30;
        }

        dataToDraw.forEach((value, key) => {
            const color = Vizard.config.channelSettings[channel !== '' ? channel : key] !== undefined ?
                Vizard.config.channelSettings[channel !== '' ? channel : key].color :
                '#ffffff';
            if (value.length > 0) {
                const lineGenerator = d3.line<any>()
                    .x(function (d) {
                        return xScale(d[0]);
                    })
                    .y(function (d) {
                        return yScale(d[1]);
                    });
                svg.append('path')
                    .datum(value)
                    .attr('fill', 'none')
                    .attr('stroke', color)
                    .attr('stroke-width', 1.5)
                    .attr('channel', channel !== '' ? channel.trim() : key.trim())
                    .attr('id', '' + (id !== -1 ? id : key))
                    .attr('d', lineGenerator)
                    .attr('transform', 'translate(' +
                        [margin.left, margin.bottom] + ')')
                    .on('mouseover', function (d, i) {
                        // Getting the relative X Position to draw a Sphere on the Path of the Cone
                        const boundingClientRect = this.getBoundingClientRect() as DOMRect;
                        const relativeXPos = (d.clientX - boundingClientRect.x) / boundingClientRect.width;
                        highlightAllLinesAndConesWithId(d3.select(this).attr('id').toString(),
                            6, geoPainter, new Color(1, 0, 0), relativeXPos);
                    })
                    .on('mouseout', function (d) {
                        highlightAllLinesAndConesWithId(d3.select(this).attr('id').toString(),
                            1.5, geoPainter, new Color(1, 1, 0));
                    });


                svg.append('circle')
                    .attr('cx', width - 80 + legendOffsetX + additionalOffsetX)
                    .attr('cy', 10 + legendOffsetY + additionalOffsetY)
                    .attr('r', 6)
                    .attr('channel', channel !== '' ? channel.trim() : key.trim())
                    .style('fill', color);
                svg.append('text')
                    .attr('x', width - 70 + legendOffsetX + additionalOffsetX)
                    .attr('y', 16 + legendOffsetY + additionalOffsetY)
                    .text(key)
                    .attr('font-family', 'Roboto Mono, Source Code Pro, Menlo, Courier, monospace')
                    .attr('channel', channel !== '' ? channel.trim() : key.trim())
                    .style('fill', color);
                legendOffsetY += 14;
            }
        });
        legendOffsetY += 28;
        if (channel === '') {
            const xShiftForInteractionProfiles = 120;
            svg.append('text')
                .attr('x', width - xShiftForInteractionProfiles + legendOffsetX)
                .attr('y', 16 + legendOffsetY + 16)
                .text(id)
                .attr('font-family', 'Roboto Mono, Source Code Pro, Menlo, Courier, monospace')
                .style('fill', '#FFFFFF');

            svg.append('text')
                .attr('x', width - xShiftForInteractionProfiles + legendOffsetX)
                .attr('y', 16 + legendOffsetY)
                .text('Set Ref.')
                .attr('id', id)
                .attr('font-family', 'Roboto Mono, Source Code Pro, Menlo, Courier, monospace')
                .style('fill', '#FFFFFF')
                .on('click', async function (d) {
                    // console.log("Here " + d3.select(this).attr('id').toString())
                    const gs = d3.select('#small_dataviz_container').selectAll('g').nodes();
                    const currentOrder = new Map<string, number>();
                    const elements = new Map<string, SVGPathElement>();
                    for (let i = 0; i < gs.length; i++) {
                        const graph = gs[i] as SVGPathElement;
                        if (graph.getAttribute('id') !== null) { // @ts-ignore
                            currentOrder.set(graph.getAttribute('id').split('_')[0],
                                parseInt(graph.getAttribute('id')!.split('_')[1]));
                            // @ts-ignore
                            elements.set(graph.getAttribute('id').split('_')[0].toString(), graph);
                        }
                    }
                    console.log('Current Order');
                    console.log(currentOrder);
                    console.log('Get the Ranks for the Visualizations');
                    const newOrder = await fetch('intensities/rank?' +
                        new URLSearchParams({
                            id: `${d3.select(this).attr('id')}`,
                            radius: `${Vizard.config.radius}`,
                            channels: Vizard.config.wantedInteractions.join(','),
                            thresholds: Vizard.config.thresholds.join(','),
                            edges: Array.from(currentOrder.keys()).join(','),
                            shape: `${Vizard.config.shape}`,
                        })).then((response) => response.json()) as number[];
                    console.log('New Order');
                    console.log(newOrder);
                    newOrder.forEach((o) => {
                        const newPlace = newOrder.indexOf(o);
                        const oldPlace = currentOrder.get(o.toString())!;
                        console.log(newPlace, oldPlace)
                        // @ts-ignore
                        elements.get(o.toString()).setAttribute('transform',
                            'translate(0,' + (40 + (240 * (newPlace - oldPlace))) + ')');
                    });
                });

            svg.append('text')
                .attr('x', width - xShiftForInteractionProfiles + legendOffsetX)
                .attr('y', 16 + legendOffsetY + 32)
                .text('download')
                .attr('id', id)
                .attr('font-family', 'Roboto Mono, Source Code Pro, Menlo, Courier, monospace')
                .style('fill', '#FFFFFF')
                .on('click', async function (d) {
                    // console.log("Here " + d3.select(this).attr('id').toString())
                    const gs = d3.select('#small_dataviz_container').selectAll('g').nodes();
                    const currentOrder = new Map<string, number>();
                    const elements = new Map<string, SVGPathElement>();
                    for (let i = 0; i < gs.length; i++) {
                        const graph = gs[i] as SVGPathElement;
                        if (graph.getAttribute('id') !== null) { // @ts-ignore
                            currentOrder.set(graph.getAttribute('id').split('_')[0],
                                parseInt(graph.getAttribute('id')!.split('_')[1]));
                            // @ts-ignore
                            elements.set(graph.getAttribute('id').split('_')[0].toString(), graph);
                        }
                    }
                    // console.log("Current Order")
                    // console.log(currentOrder)
                    const intensitiesCsv = await fetch('intensity/csv?' +
                        new URLSearchParams({
                            id: `${d3.select(this).attr('id')}`,
                            radius: `${Vizard.config.radius}`,
                            channels: Vizard.config.wantedInteractions.join(','),
                            thresholds: Vizard.config.thresholds.join(','),
                            shape: `${Vizard.config.shape}`,
                        }));
                    const blob = await intensitiesCsv.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'intensities.csv';
                    a.click();
                    window.URL.revokeObjectURL(url);
                });
        }
    }

    // Draw Comparison view
    public drawComparisonView(interactionsMap: Map<number, { [key: string]: { [key: string]: number[] } }[]>,
                              geoPainter: GeoPainter, app: App, heatmap: Boolean = false,): void {
        d3.select('#dataviz_container').selectAll('*').remove();
        document.getElementById(
            'dataviz_container')!.style.backgroundColor =
            'rgba(127, 128, 136, 0.2)';
        document.getElementById(
            'dataviz_container')!.style.borderRadius = '10px';
        document.getElementById('dataviz_container')!.style.width =
            (0) + 'px';
        document.getElementById('dataviz_wrapper')!.style.display = 'block';

        const margin = {top: 40, right: 20, bottom: 5, left: 60};
        const width = 450 - margin.left - margin.right;
        const height = 200 - margin.top - margin.bottom;

        document.getElementById('dataviz_container')!.style.height = '220px';


        d3.select('#dataviz_container').append('rect').attr('height', '250')
            .attr('width', '30')
            .style('fill', '#555555');
        d3.select('#dataviz_container')
            .append('g').attr('transform', 'translate(20,218), rotate(270,0,0)')
            .append('text').text('Interactions per Channel')
            .attr('font-family', 'Roboto Mono, Source Code Pro, Menlo, Courier, monospace')
            .style('fill', '#ffffff')
            .style('font-size', '15px');

        // TODO: Save xMax and yMax in this Map as well
        // eslint-disable-next-line comma-spacing
        let legendOffset = 0;
        // eslint-disable-next-line func-call-spacing
        const allDataNew = new Map<string, Map<number, ((number[])[])>>();
        interactionsMap.forEach((value, key) => {
            let xMax: number;
            let yMax: number;
            let dataToDraw: Map<string, number[][]>;
            // @ts-ignore
            // eslint-disable-next-line prefer-const, no-unused-vars
            [dataToDraw, xMax, yMax] = this.getDataToDraw(value[key], true);

            dataToDraw.forEach((value1, key1) => {
                if (allDataNew.get(key1) === undefined) {
                    // eslint-disable-next-line func-call-spacing
                    const map = new Map<number, ((number[])[])>();
                    // @ts-ignore
                    map.set(key, value1);
                    allDataNew.set(key1, map);
                } else {
                    const data = allDataNew.get(key1);
                    // @ts-ignore
                    data.set(key, value1);
                    // @ts-ignore
                    allDataNew.set(key1, data);
                }
            });
        });

        const svg = d3.select('#dataviz_container').append('g')
            .attr('transform', 'translate(' +
                [margin.left, margin.bottom] + ')');

        let maxSize = 0;

        allDataNew.forEach((value, key) => {
            const datavizContainer =
                document.getElementById('dataviz_container');
            if (heatmap) {
                // Find the amount of non empty data //TODO could be done better
                let interactionsCount = 0;
                value.forEach((val, k) => {
                    if (val.length > 0) {
                        // Draw the heatmap with the given values (1 line)
                        const sum = val.reduce((a, b) => a + b[1], 0);
                        if (sum > 0) interactionsCount++;
                    }
                });
                // console.log(interactionsCount);
                const binHeight = 12;
                maxSize = maxSize < (interactionsCount * binHeight) ? interactionsCount * binHeight : maxSize;
                maxSize = maxSize + margin.top + margin.bottom;
                document.getElementById('dataviz_container')!.style.height = ((maxSize > 240) ? maxSize : 240) + 'px';

                svg.append('g').attr('transform', 'translate(' + legendOffset + ',10)')
                    .append('text').text(key)
                    .attr('font-family', 'Roboto Mono, Source Code Pro, Menlo, Courier, monospace')
                    .style('fill', '#ffffff')
                    .style('font-size', '15px');

                const offset = 14;
                let i = 0;
                value.forEach((val, k) => {
                    if (val.length > 0) {
                        // Draw the heatmap with the given values (1 line)
                        const sum = val.reduce((a, b) => a + b[1], 0);
                        if (sum > 0) {
                            const dataToDraw = val.map((a) => {
                                return {variable: k, group: a[0], value: a[1]};
                            });
                            const group = val.map((a) => a[0]);
                            // @ts-ignore
                            const x = d3.scaleBand().range([0, width - 80]).domain(group)
                                .padding(0);
                            const y = d3.scaleBand().range([binHeight, 0]).domain([k.toString()])
                                .padding(0.0);

                            svg.append('g')
                                .style('font-size', 10)
                                .attr('transform', 'translate(' + legendOffset + ',' + ((i * binHeight) + offset) + ')')
                                .call(d3.axisLeft(y).tickSize(0))
                                .select('.domain').remove();

                            // add the squares
                            // @ts-ignore
                            const yGenerator = function (d) {
                                return y(d.variable);
                            };
                            // @ts-ignore
                            const xGenerator = function (d) {
                                return x(d.group);
                            };
                            // @ts-ignore
                            const rect = svg.selectAll()
                                .data(dataToDraw)
                                .enter()
                                .append('rect')
                                .attr('transform', 'translate(' + legendOffset + ',' + ((i * binHeight) + offset) + ')')
                                .attr('id', k);
                            // @ts-ignore
                            rect.attr('x', xGenerator);
                            // @ts-ignore
                            rect.attr('y', yGenerator)
                                .attr('rx', 0)
                                .attr('ry', 0)
                                .attr('width', x.bandwidth())
                                .attr('height', y.bandwidth())
                                .attr('id', k)
                                .style('fill', function (d) {
                                    // @ts-ignore
                                    return myColor(d.value);
                                })
                                .style('stroke-width', 4)
                                .style('stroke', 'none')
                                .style('opacity', 0.8)
                                .on('mouseover', function (d, i) {
                                    highlightAllLinesAndConesWithId(i.variable.toString(),
                                        6, geoPainter, new Color(1, 0, 0), i.group);
                                })
                                .on('mouseout', function (d, i) {
                                    highlightAllLinesAndConesWithId(i.variable.toString(),
                                        1.5, geoPainter, new Color(1, 1, 0));
                                })
                                .on('mousedown', function (d) {
                                    let lineID = Number(d3.select(this).attr('id').toString())
                                    // console.log("MouseDown with ID " + lineID)
                                    if (geoPainter.addingEdges) {
                                        geoPainter.selectedEdge.indexOf(lineID) === -1 ?
                                            geoPainter.selectedEdge.push(lineID) :
                                            geoPainter.selectedEdge = geoPainter.selectedEdge
                                                .filter((obj) => obj !== lineID);
                                    } else {
                                        geoPainter.selectedEdge = [];
                                        geoPainter.selectedEdge.push(lineID);
                                    }
                                    selectEdge(app.geometricScene, geoPainter.edgeColor, geoPainter.selectedEdge, geoPainter.config.wireframe);
                                    app.getIntensities();
                                });
                            i++;
                        }
                    }
                    // @ts-ignore
                    // this.drawHeatmap('#dataviz_container', margin, height, width, geoPainter, 0, legendOffset, value,
                    //     1, 1, key, key, -1); // TODO adapt xMax and yMax
                });
            } else {
                // @ts-ignore
                this.drawGraph('#dataviz_container', margin, height, width, geoPainter, 0, legendOffset, value,
                    1, 1, app, key, key, -1, -1, 15, 0); // TODO adapt xMax and yMax
            }
            margin.left += width + 5;
            let currentWidth = parseInt(datavizContainer!.style.width);
            if (!currentWidth) currentWidth = 0;
            datavizContainer!.style.width = (currentWidth + width + 5) + 'px';
            legendOffset = (currentWidth + width + 5);
        });
    }

    public paintPolarizationHeatmap(data: Map<string, object[]>) {
        d3.select('#polarization_dataviz_container').selectAll('*').remove();
        document.getElementById('polarization_dataviz_container')!.style.backgroundColor = 'rgba(127, 128, 136, 0.2)';
        document.getElementById('polarization_dataviz_container')!.style.borderRadius = '10px';
        document.getElementById('polarization_dataviz_container')!.style.width = (0) + 'px';
        document.getElementById('polarization_dataviz_wrapper')!.style.display = 'block';
        const margin = {top: 25, right: 20, bottom: 15, left: 50};
        const width = 450 - margin.left - margin.right;
        const height = 300 - margin.top - margin.bottom;
        d3.select('#polarization_dataviz_container').append('rect').attr('height', '350')
            .attr('width', '30')
            .style('fill', '#555555');
        d3.select('#polarization_dataviz_container')
            .append('g').attr('transform', 'translate(20,240), rotate(270,0,0)')
            .append('text').text('Polarizaiton Heatmap')
            .attr('font-family', 'Roboto Mono, Source Code Pro, Menlo, Courier, monospace')
            .style('fill', '#ffffff')
            .style('font-size', '15px');

        data.forEach((heatmapData, key) => {
            // Selected Edge is key
            let groups = [] as number[];
            let vars = [] as number[];
            // @ts-ignore
            heatmapData.map((data) => groups.push(data.group));
            // @ts-ignore
            heatmapData.map((data) => vars.push(data.variable));
            vars = [...new Set(vars)];
            groups = [...new Set(groups)];
            this.drawHeatMapPolarization(heatmapData, '#polarization_dataviz_container',
                vars, groups, width, height, margin, key);
            margin.left += width;
            let currentWidth = parseInt(document.getElementById('polarization_dataviz_container')!.style.width);
            if (!currentWidth) currentWidth = 0;
            document.getElementById('polarization_dataviz_container')!.style.width = (currentWidth + width + 15) + 'px';
        });
    }

    private drawHeatMapPolarization(data: object[], selector: string,
                                    myVars: number[], myGroups: number[], width: number, height: number,
                                    margin: { top: number, right: number, left: number, bottom: number }, key: string) {
        d3.select(selector).append('g').attr('transform', 'translate(' + (margin.left + 60) + ',20)')
            .append('text').text(key)
            .attr('font-family', 'Roboto Mono, Source Code Pro, Menlo, Courier, monospace')
            .style('fill', '#ffffff')
            .style('font-size', '15px');
        const svg = d3.select(selector).append('g').attr('transform', 'translate(' +
            [margin.left, margin.top] + ')');
        // Build X scales and axis:
        // @ts-ignore
        const x = d3.scaleBand().range([0, width - 80]).domain(myGroups)
            .padding(0);
        // Build Y scales and axis:
        // @ts-ignore
        const y = d3.scaleBand().range([height, 0]).domain(myVars)
            .padding(0.0);
        svg.append('g')
            .style('font-size', 10)
            .attr('transform', 'translate(50,0)')
            .call(d3.axisLeft(y).tickSize(0))
            .select('.domain').remove();


        // add the squares
        const yGenerator = function (d: object) {
            // @ts-ignore
            return y(d.variable);
        };
        const xGenerator = function (d: object) {
            // @ts-ignore
            return x(d.group);
        };
        const rect = svg.selectAll()
            .data(data)
            .enter()
            .append('rect')
            .attr('transform', 'translate(50,0)');
        // @ts-ignore
        rect.attr('x', xGenerator);
        // @ts-ignore
        rect.attr('y', yGenerator)
            .attr('rx', 0)
            .attr('ry', 0)
            .attr('width', x.bandwidth())
            .attr('height', y.bandwidth())
            .style('fill', function (d: object) {
                // @ts-ignore
                return myColor(d.value);
            })
            .style('stroke-width', 4)
            .style('stroke', 'none')
            .style('opacity', 0.8);
    }

    public paintHeatmap(interactionsMap: Map<number,
        { [key: string]: { [key: string]: number[] } }[]>, geoPainter: GeoPainter, binSize: number, app: App): void {
        d3.select('#small_dataviz_container').selectAll('*').remove();
        document.getElementById('small_dataviz_container')!.style.height =
            (0) + 'px';

        // document.getElementById(
        // 'small_dataviz_container')!.style.backgroundColor =
        // 'rgba(0,0,0,.5)';
        const margin = {top: 20, right: 60, bottom: 60, left: 0};
        const width = 450 - margin.left - margin.right;
        const height = 300 - margin.top - margin.bottom;

        d3.select('#small_dataviz_container')
            .append('rect').attr('height', '30')
            .attr('width', '480')
            .style('fill', '#555555');
        d3.select('#small_dataviz_container')
            .append('g').attr('transform', 'translate(20,20)')
            .append('text').text('Cell Interaction Profiles')
            .attr('font-family', 'Roboto Mono, Source Code Pro, Menlo, Courier, monospace')
            .style('fill', '#ffffff')
            .style('font-size', '15px');

        // Title Adaption
        document.getElementById('small_dataviz_container')!.style.height =
            parseInt(document.getElementById('small_dataviz_container')!.style.height) + 20 + 'px';
        document.getElementById(`small_dataviz_container`)!.style.backgroundColor = 'rgba(127, 128, 136, 0.2)';
        document.getElementById('small_dataviz_container')!.style.borderRadius = '10px';
        document.getElementById('small_dataviz_container')!.style.paddingBottom = '10px';

        let legendOffset = 0;
        interactionsMap.forEach((value, key) => {
            let dataToDraw: Map<string, number[][]>;
            let xMax: number;
            let yMax: number;
            // @ts-ignore
            // eslint-disable-next-line prefer-const
            [dataToDraw, xMax, yMax] = this.getDataToDraw(value[key], true);

            // Transform the data to binned #bins per channel

            const newDataToDraw = [] as object[];
            dataToDraw.forEach((value, key) => {
                binSize = value.length;
                for (let i = 0; i < binSize; i++) {
                    newDataToDraw.push({variable: key, group: i, value: value[i][1]});
                }
            });
            d3.select('#small_dataviz_container')
                .append('g').attr('transform', 'translate(50,' + (margin.bottom - 5) + ')')
                .append('text').text(key)
                .attr('font-family', 'Roboto Mono, Source Code Pro, Menlo, Courier, monospace')
                .style('fill', '#ffffff')
                .style('font-size', '15px');
            this.drawHeatmap('#small_dataviz_container', margin, height, width, geoPainter, legendOffset, 0,
                newDataToDraw, xMax, yMax, '', '', key, app);

            margin.bottom += height + 40;
            const smallDatavizContainer =
                document.getElementById('small_dataviz_container');

            let currentHeight = parseInt(smallDatavizContainer!.style.height);
            if (!currentHeight) {
                currentHeight = 0;
            }
            smallDatavizContainer!.style.height =
                (currentHeight + height + 40) + 'px';
            legendOffset = currentHeight + height + margin.bottom;
        });
    }

    public drawInteractionView(interactionsMap: Map<number,
        { [key: string]: { [key: string]: number[] } }[]>, geoPainter: GeoPainter, app: App): void {
        if (interactionsMap.size === 0) {
            return;
        }
        d3.select('#small_dataviz_container').selectAll('*').remove();
        document.getElementById('small_dataviz_container')!.style.height = (0) + 'px';
        document.getElementById('small_dataviz_wrapper')!.style.display = 'block';
        // document.getElementById('small_dataviz_wrapper')!.style.top = '260px';
        // document.getElementById('small_dataviz_wrapper')!.style.left = '18px';
        // document.getElementById('small_dataviz_wrapper')!.style.height = '70%';

        const margin = {top: 20, right: 20, bottom: 5, left: 40};
        const width = 450 - margin.left - margin.right;
        const height = 200 - margin.top - margin.bottom;

        let legendOffset = 0;
        let order = 0;

        d3.select('#small_dataviz_container')
            .append('rect').attr('height', '30')
            .attr('width', '480')
            .style('fill', '#555555');
        d3.select('#small_dataviz_container')
            .append('g').attr('transform', 'translate(20,20)')
            .append('text').text('Cell Interaction Profiles')
            .attr('font-family', 'Roboto Mono, Source Code Pro, Menlo, Courier, monospace')
            .style('fill', '#ffffff')
            .style('font-size', '15px');

        interactionsMap.forEach((value, key) => {
            let dataToDraw: Map<string, number[][]>;
            let xMax: number;
            let yMax: number;
            // @ts-ignore
            // eslint-disable-next-line prefer-const
            [dataToDraw, xMax, yMax] = this.getDataToDraw(value[key], false);
            const initialMove = 40;
            this.drawGraph('#small_dataviz_container', margin, height, width, geoPainter, legendOffset, 0,
                dataToDraw, xMax, yMax, app, '', '', key, order, initialMove);
            margin.bottom += height + initialMove + 25;
            const smallDatavizContainer =
                document.getElementById('small_dataviz_container');
            let currentHeight = parseInt(smallDatavizContainer!.style.height);
            if (!currentHeight) {
                currentHeight = 0;
            }
            smallDatavizContainer!.style.height = (currentHeight + height + initialMove + 25) + 'px';
            legendOffset = currentHeight + height + initialMove + 25;
            order++;
        });
        // Title Adaption
        document.getElementById('small_dataviz_container')!.style.height =
            parseInt(document.getElementById('small_dataviz_container')!.style.height) + 20 + 'px';

        document.getElementById(`small_dataviz_container`)!.style.backgroundColor = 'rgba(127, 128, 136, 0.2)';
        document.getElementById('small_dataviz_container')!.style.borderRadius = '10px';
        // document.getElementById('small_dataviz_container')!.style.paddingTop = '10px';
        document.getElementById('small_dataviz_container')!.style.paddingBottom = '10px';
    }

    public updateColors(): void {
        this.updateColorsPerVis('#dataviz_container');
        this.updateColorsPerVis('#small_dataviz_container');
    }

    public updateColorsPerVis(selector: string): void {
        const paths = d3.select(selector).selectAll('g')
            .selectChildren('path').nodes();
        const texts = d3.select(selector).selectAll('g')
            .selectChildren('text').nodes();
        const circles = d3.select(selector).selectAll('g')
            .selectChildren('circle').nodes();
        for (let i = 0; i < paths.length; i++) {
            const path = paths[i] as SVGPathElement;
            if (path !== undefined && path.getAttribute('channel') !== undefined) {
                const channel = path.getAttribute('channel') as string;
                const color = Vizard.config.channelSettings[channel + ' '] !==
                undefined ? Vizard.config.channelSettings[channel + ' '].color : '#FFFFFF';
                path.setAttribute('stroke', color);
            }
        }

        for (let i = 0; i < texts.length; i++) {
            const text = texts[i] as SVGTextElement;
            if (text !== undefined && text.getAttribute('channel') !== undefined) {
                const channel = text.getAttribute('channel') as string;
                const color = Vizard.config.channelSettings[channel + ' '] !==
                undefined ? Vizard.config.channelSettings[channel + ' '].color : '#FFFFFF';
                text.setAttribute('style', `fill: ${color}`);
            }
        }

        for (let i = 0; i < circles.length; i++) {
            const circle = circles[i] as SVGCircleElement;
            if (circle !== undefined && circle.getAttribute('channel') !== undefined) {
                const channel = circle.getAttribute('channel') as string;
                const color = Vizard.config.channelSettings[channel + ' '] !==
                undefined ? Vizard.config.channelSettings[channel + ' '].color : '#FFFFFF';
                circle.setAttribute('style', `fill: ${color}`);
            }
        }
    }
}
