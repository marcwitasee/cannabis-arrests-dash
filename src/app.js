import {getCountiesWithAllYears} from './utils';
import {select, selectAll} from 'd3-selection';
import {json} from 'd3-fetch';
import {extent} from 'd3-array';
import {line} from 'd3-shape';
import {scaleLinear, scaleTime, scaleBand, scaleQuantize} from 'd3-scale';
import {axisBottom, axisLeft} from 'd3-axis';
import {geoPath, geoAlbers} from 'd3-geo';
import {schemeBlues} from 'd3-scale-chromatic';
import './main.css';
json('./data/cannabis_arrests.json')
  .then(myVis)
  .catch(e => {
    console.log(e);
  });

Promise.all([
  json('./data/cannabis_arrests.json'),
  json('./data/coPopulation.json'),
])
  .then(myBarChart)
  .catch(e => {
    console.log(e);
  });

// Promise.all([
//   json('./data/cannabis_arrests.json'),
//   json('./data/Counties in Colorado.geojson'),
//   json('./data/coPopulation.json'),
// ])
//   .then(myMap)
//   .catch(e => console.log(e));

Promise.all([
  json('./data/cannabis_arrests.json'),
  json('./data/Counties in Colorado.geojson'),
  json('./data/coPopulation.json'),
])
  .then(myCharts)
  .catch(e => console.log(e));

function getYearTotals(data, key, value, year) {
  let grouped;
  if (year) {
    grouped = data.reduce((acc, row) => {
      if (row['ArrestYear'] == year) {
        acc[row[key]] = (acc[row[key]] || 0) + row[value];
      }
      return acc;
    }, {});
  } else {
    grouped = data.reduce((acc, row) => {
      const counties = getCountiesWithAllYears();
      if (counties.includes(row['County'])) {
        acc[row[key]] = (acc[row[key]] || 0) + row[value];
      }
      return acc;
    }, {});
  }
  return Object.entries(grouped).map(([x, y]) => ({x, y}));
}

function getPopPercent(data, county) {
  const row = data.find(element => element.County === county);
  const rv = {name: '% of Pop.', percent: row.blackPct};
  return rv;
}

function getArrestPercent(data) {
  const total = data.reduce((acc, row) => {
    acc = acc + row.totalArrests;
    return acc;
  }, 0);
  const percentArray = data.map(element => {
    const rv = {
      percent: element.blackArrests / element.totalArrests,
      weight: element.totalArrests / total,
    };
    return rv;
  });
  const arrestPercent = percentArray.reduce((acc, row) => {
    acc = acc + row.percent * row.weight;
    return acc;
  }, 0);
  return {name: '% of Cannabis Arrests', percent: arrestPercent};
}

function myCharts(data) {
  const [arrests, mapData, population] = data;
  console.log(arrests);
  console.log(mapData);
  console.log(population);

  const width = 650;
  const height = 500;
  const margin = {top: 0, bottom: 0, left: 0, right: 0};
  let year = undefined;

  const svg = select('#map')
    .append('svg')
    .attr('height', height)
    .attr('width', width)
    .append('g')
    .attr('transform', `translate(${margin.left}, ${margin.top})`);

  const coProjection = geoAlbers()
    .scale(6500)
    .rotate([105.490632, 0])
    .center([0, 38.999])
    .translate([width / 2, height / 2]);

  selectAll('.year-button').on('change', event => {
    const input = event.target.id;
    if (input === 'All Years') year = undefined;
    else year = +event.target.id;
    myMap(data, year, svg, coProjection);
  });

  myMap(data, year, svg, coProjection);
}

function myVis(data) {
  const width = 800;
  const height = 200;
  const margin = {top: 0, bottom: 50, left: 50, right: 20};
  const plotHeight = height - margin.bottom - margin.top;
  const plotWidth = width - margin.left - margin.right;
  const yearTotals = getYearTotals(
    data,
    'ArrestYear',
    'totalArrests',
    undefined,
  );
  const xDomain = extent(yearTotals, d => new Date(`01/01/${d.x}`));
  const yDomain = extent(yearTotals, d => d.y);

  const xScale = scaleTime()
    .domain(xDomain)
    .range([0, plotWidth]);

  const yScale = scaleLinear()
    .domain([yDomain[0] - 1000, yDomain[1] + 1000])
    .range([plotHeight, 0]);

  const lineScale = line()
    .x(d => xScale(new Date(`01/01/${d.x}`)))
    .y(d => yScale(d.y));

  const svg = select('#line-chart')
    .append('svg')
    .attr('height', height)
    .attr('width', width)
    .append('g')
    .attr('transform', `translate(${margin.left}, ${margin.top})`);

  svg
    .append('g')
    .attr('class', 'x-axis')
    .call(axisBottom(xScale))
    .attr('transform', `translate(0, ${plotHeight})`);

  svg
    .append('g')
    .attr('class', 'y-axis')
    .call(
      axisLeft(yScale)
        .tickSize(-plotWidth)
        .ticks(7),
    );

  svg
    .append('g')
    .attr('class', 'x-axis-label')
    .attr('transform', `translate(${plotWidth / 2}, ${height - 20})`)
    .append('text')
    .attr('text-anchor', 'middle')
    .text('Year');

  svg
    .append('g')
    .attr('class', 'y-axis-label')
    .attr('transform', `translate(-35, ${plotHeight / 2})`)
    .append('text')
    .attr('text-anchor', 'middle')
    .attr('transform', 'rotate(-90)')
    .text('Total Arrests');

  svg
    .selectAll('.arrest-trend')
    .data([yearTotals])
    .join('path')
    .attr('class', 'arrest-trend')
    .attr('d', d => lineScale(d))
    .attr('stroke', '#A31621')
    .attr('stroke-width', 3)
    .attr('fill', 'none');
}

function myBarChart(data) {
  const [arrests, pop] = data;

  const height = 300;
  const width = 300;
  const margin = {top: 50, bottom: 50, left: 50, right: 50};
  const plotHeight = height - margin.top - margin.bottom;
  const plotWidth = width - margin.left - margin.right;
  const arrestPercent = getArrestPercent(arrests);
  const popPercent = getPopPercent(pop, 'statewide');
  const prepData = [popPercent, arrestPercent];

  const xDomain = extent(prepData, d => d.name);
  const yDomain = extent(prepData, d => d.percent);

  const xScale = scaleBand()
    .domain(xDomain)
    .range([0, plotWidth]);

  const yScale = scaleLinear()
    .domain([0, yDomain[1]])
    .range([0, plotHeight]);

  const svg = select('#bar-chart')
    .append('svg')
    .attr('height', height)
    .attr('width', width)
    .append('g')
    .attr('transform', `translate(${margin.left}, ${margin.top})`);

  const rectContainer = svg.append('g').attr('class', 'rect-container');
  rectContainer
    .selectAll('rect')
    .data(prepData)
    .join('rect')
    .attr('x', d => xScale(d.name))
    .attr('y', d => plotHeight - yScale(d.percent))
    .attr('height', d => yScale(d.percent))
    .attr('width', xScale.bandwidth())
    .attr('fill', 'steelblue')
    .attr('stroke', 'white');

  svg
    .append('g')
    .attr('class', 'x-axis')
    .call(axisBottom(xScale))
    .attr('transform', `translate(0, ${plotHeight})`);

  svg
    .append('g')
    .attr('class', 'y-axis')
    .call(axisLeft(yScale.range([plotHeight, 0])));

  svg
    .append('g')
    .attr('class', 'y-axis-label')
    .attr('transform', `translate(-35, ${plotHeight / 2})`)
    .append('text')
    .attr('text-anchor', 'middle')
    .attr('transform', 'rotate(-90)')
    .text('Percentage');
}

function myMap(data, year, svg, projection) {
  const [arrests, mapData, population] = data;

  const popTotals = new Map(
    population.map(obj => [obj.County.toUpperCase(), obj.totalPop]),
  );

  let totals = getYearTotals(arrests, 'County', 'totalArrests', year);
  const xDomain = extent(totals, d => d.y);
  totals = Object.assign(
    new Map(totals.map(obj => [obj.x.toUpperCase(), obj.y])),
  );
  // console.log(totals);

  const color = scaleQuantize(xDomain, schemeBlues[9]);

  const co_geoPath = geoPath(projection);

  svg
    .selectAll('path')
    .data(mapData.features)
    .join('path')
    .attr('fill', d => {
      // console.log(d);
      // console.log(totals.get(d.properties.county));
      // console.log(
      //   (totals.get(d.properties.county) / popTotals.get(d.properties.county)) *
      //     1000,
      // );
      // console.log(totals.get(d.properties.county));
      return color(totals.get(d.properties.county));
    })
    .attr('stroke', '#333')
    .attr('d', co_geoPath);
}
