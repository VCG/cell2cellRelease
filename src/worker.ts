import {Volume} from './volume_painter';

export class WorkerClass {
  constructor() {}
  async getVolume(marker: string): Promise<Volume> {
    const volume =
    (await fetch('volume/' + marker)).json() as unknown as Volume;
    return volume;
  }
}
