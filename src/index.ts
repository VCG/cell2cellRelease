import './style.css';

document
    .getElementById('precomputeButton')!
    .addEventListener('click', precompute);

document
    .getElementById('precomputeDeleteButton')!
    .addEventListener('click', deletePrecomputation);

async function precompute() {
  const volumePath = (document.getElementById('volumePath') as any)!.value;

  try {
    const response = await fetch('http://localhost:8080/volumePath', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({volumePath: volumePath}),
    });

    if (!response.ok) {
      alert('Error: invalid path!');
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    await precomputeIntensities();
    await precomputePolarizations();
  } catch (error) {
    console.error(error);
  }
}

async function precomputeIntensities() {
  const edgeIds: string[] = [];

  const shapeSelect: any = document.getElementById('shape')!;
  const shape = shapeSelect.options[shapeSelect.selectedIndex].value;

  const progressValue = document.getElementById('progressBarText');
  progressValue!.innerHTML = 'Precomputing all interactions ... 0%';
  progressValue!.style.display = 'block';

  const progressBar = document.getElementById('progressBar');
  const progressBarContainer = document.getElementById('progressBarContainer');
  progressBarContainer!.style.display = 'block';
  progressBar!.style.width = 0 + '%';

  await fetch('http://localhost:8080/edges')
      .then((response) => response.json())
      .then((data) => {
        data.map((item: any) => edgeIds.push(item['id']));
      });

  const radii = [5, 10, 15, 20, 25, 30];
  let i = 0;
  for (const edgeId of edgeIds) {
    await fetch('http://localhost:8080/precomputeIntensities', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: `${edgeId}`, radii: `${radii}`, shape: `${shape}`}),
    });

    i++;
    const percentages = Math.round((i / edgeIds.length) * 100.0);
    progressBar!.style.width = percentages + '%';
    progressValue!.innerHTML =
    `Precomputing all interactions ... ${percentages}%`;
  }
}

async function precomputePolarizations() {
  const vertexIds: string[] = [];

  const progressValue = document.getElementById('progressBarText');
  progressValue!.innerHTML = 'Precomputing all polarizations ... 0%';
  progressValue!.style.display = 'block';

  const progressBar = document.getElementById('progressBar');
  progressBar!.style.width = 0 + '%';
  const progressBarContainer = document.getElementById('progressBarContainer');
  progressBarContainer!.style.display = 'block';

  await fetch('http://localhost:8080/vertices')
      .then((response) => response.json())
      .then((data) => {
        data.map((item: any) => vertexIds.push(item['id']));
      });

  const radii = [5, 10, 15, 20, 25, 30];
  let i = 0;
  for (const vertexId of vertexIds) {
    await fetch('http://localhost:8080/precomputePolarizations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: `${vertexId}`, radii: `${radii}`}),
    });

    i++;
    const percentages = Math.round((i / vertexIds.length) * 100.0);
    progressBar!.style.width = percentages + '%';
    progressValue!.innerHTML =
    `Precomputing all polarizations ... ${percentages}%`;
  }
}


async function deletePrecomputation() {
  const volumePath = (document.getElementById('volumePath') as any)!.value;

  try {
    const response = await fetch('http://localhost:8080/volumePath', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({volumePath: volumePath}),
    });

    if (!response.ok) {
      alert('Error: invalid path!');
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (error) {
    console.error(error);
  }

  try {
    await confirmAlert('Are you sure?');
    await fetch('http://localhost:8080/precompute', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }});
  } catch {
    console.log('User clicked Cancel');
  }
}

function confirmAlert(message : string) : Promise<void> {
  return new Promise((resolve, reject) => {
    const confirmed = confirm(message);
    if (confirmed) {
      resolve();
    } else {
      reject(new Error('User clicked Cancel'));
    }
  });
}
