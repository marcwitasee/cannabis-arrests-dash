import {myExampleUtil} from './utils';
import {select} from 'd3-selection';
import {json} from 'd3-fetch';
import {extent} from 'd3-array';
import {line} from 'd3-shape';
import {scaleLinear, scaleTime, scaleBand} from 'd3-scale';
import './main.css';
import {axisBottom, axisLeft} from 'd3-axis';

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

function getYearTotals(data, col) {
  const grouped = data.reduce((acc, row) => {
    acc[row['ArrestYear']] = (acc[row['ArrestYear']] || 0) + row[col];
    return acc;
  }, {});
  return Object.entries(grouped).map(([x, y]) => ({x, y}));
}

function myVis(data) {
  const width = 800;
  const height = 200;
  const margin = {top: 0, bottom: 50, left: 50, right: 20};
  const plotHeight = height - margin.bottom - margin.top;
  const plotWidth = width - margin.left - margin.right;
  const yearTotals = getYearTotals(data, 'totalArrests');
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

function myBarChart(data) {
  const [arrests, pop] = data;
  console.log('hello from myBarChart');
  console.log(arrests);
  console.log(pop);

  const height = 300;
  const width = 300;
  const margin = {top: 50, bottom: 50, left: 50, right: 50};
  const plotHeight = height - margin.top - margin.bottom;
  const plotWidth = width - margin.left - margin.right;
  const arrestPercent = getArrestPercent(arrests);
  const popPercent = getPopPercent(pop, 'statewide');
  const prepData = [popPercent, arrestPercent];
  console.log(prepData);

  const xDomain = extent(prepData, d => d.name);
  const yDomain = extent(prepData, d => d.percent);
  console.log(xDomain, yDomain);

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
