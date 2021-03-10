import {myExampleUtil} from './utils';
import {select} from 'd3-selection';
import {json} from 'd3-fetch';
import {extent} from 'd3-array';
import {line} from 'd3-shape';
import {scaleLinear, scaleTime} from 'd3-scale';
import './main.css';
import {axisBottom, axisLeft} from 'd3-axis';

// this is just one example of how to import data. there are lots of ways to do it!
json('./data/arrests.json')
  .then(myVis)
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
  console.log(data);
  console.log(yearTotals);
  console.log(xDomain, yDomain);

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
    .selectAll('.arrest-trend')
    .data([yearTotals])
    .join('path')
    .attr('class', 'arrest-trend')
    .attr('d', d => lineScale(d))
    .attr('stroke', '#A31621')
    .attr('stroke-width', 3)
    .attr('fill', 'none');
}
