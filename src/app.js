import {getCountiesWithAllYears, legend} from './utils';
import {select, selectAll} from 'd3-selection';
import {json} from 'd3-fetch';
import {extent} from 'd3-array';
import {line} from 'd3-shape';
import {scaleLinear, scaleTime, scaleBand, scaleQuantize} from 'd3-scale';
import {axisBottom, axisLeft} from 'd3-axis';
import {geoPath, geoAlbers} from 'd3-geo';
import {schemeGreens} from 'd3-scale-chromatic';
import {transition} from 'd3-transition';
import {format} from 'd3-format';
import './main.css';

Promise.all([
  json('./data/cannabis_arrests.json'),
  json('./data/Counties in Colorado.geojson'),
  json('./data/coPopulation.json'),
])
  .then(myCharts)
  .catch(e => console.log(e));

function getYearTotals(data, key, value, year, county) {
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
      let counties;
      if (county) counties = [county];
      else counties = getCountiesWithAllYears().map(el => el.toUpperCase());
      if (counties.includes(row['County'].toUpperCase())) {
        acc[row[key]] = (acc[row[key]] || 0) + row[value];
      }
      return acc;
    }, {});
  }
  return Object.entries(grouped).map(([x, y]) => ({x, y}));
}

function getPopPercent(data, county) {
  const row = data.find(element => element.County.toUpperCase() === county);
  const rv = {name: '% of Pop.', percent: row.blackPct};
  return rv;
}

function getArrestPercent(data, year, county) {
  let filtered;
  if (year) filtered = data.filter(row => row.ArrestYear === year);
  else filtered = data;

  if (county) {
    filtered = filtered.filter(row => row.County.toUpperCase() === county);
  }

  const total = filtered.reduce(
    (acc, row) => (acc = acc + row.totalArrests),
    0,
  );
  const percentArray = filtered.map(element => {
    const rv = {
      percent: element.blackArrests / element.totalArrests,
      weight: element.totalArrests / total,
    };
    return rv;
  });

  const arrestPercent = percentArray.reduce(
    (acc, row) => (acc = acc + row.percent * row.weight),
    0,
  );
  return {name: '% of Cannabis Arrests', percent: arrestPercent};
}

function myCharts(data) {
  // Static map elements
  const mapWidth = 650;
  const mapHeight = 500;
  const mapMargin = {top: 0, bottom: 0, left: 0, right: 0};
  let year = undefined;
  let county = undefined;
  let highlightCounty = undefined;

  const mapContainer = select('#map')
    .append('div')
    .attr('class', 'map-container')
    .style('position', 'relative');

  const mapSvg = mapContainer
    .append('svg')
    .attr('height', mapHeight)
    .attr('width', mapWidth)
    .append('g')
    .attr('id', 'map-paths')
    .attr('transform', `translate(${mapMargin.left}, ${mapMargin.top})`);

  const tooltip = mapContainer
    .append('div')
    .attr('id', 'tooltip')
    .style('display', 'none');

  const coProjection = geoAlbers()
    .scale(6500)
    .rotate([105.490632, 0])
    .center([0, 38.999])
    .translate([mapWidth / 2, mapHeight / 2]);

  myMap(data, year, mapSvg, coProjection, tooltip, highlightCounty);

  // Static bar chart elements
  const bcHeight = 300;
  const bcWidth = 300;
  const bcMargin = {top: 10, bottom: 20, left: 50, right: 5};
  const bcPlotHeight = bcHeight - bcMargin.top - bcMargin.bottom;
  const bcPlotWidth = bcWidth - bcMargin.left - bcMargin.right;

  const bcSvg = select('#bar-chart')
    .append('svg')
    .attr('height', bcHeight)
    .attr('width', bcWidth)
    .append('g')
    .attr('transform', `translate(${bcMargin.left}, ${bcMargin.top})`);

  const bcXAxis = bcSvg
    .append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0, ${bcPlotHeight})`);

  const bcYAxis = bcSvg.append('g').attr('class', 'y-axis');

  bcSvg
    .append('g')
    .attr('class', 'y-axis-label')
    .attr('transform', `translate(-40, ${bcPlotHeight / 2})`)
    .append('text')
    .attr('text-anchor', 'middle')
    .attr('transform', 'rotate(-90)')
    .text('Percentage');

  const rectContainer = bcSvg.append('g').attr('class', 'rect-container');

  myBarChart(
    data,
    year,
    county,
    rectContainer,
    bcXAxis,
    bcYAxis,
    bcPlotWidth,
    bcPlotHeight,
  );

  const lcWidth = 800;
  const lcHeight = 200;
  const lcMargin = {top: 10, bottom: 30, left: 50, right: 20};
  const lcPlotHeight = lcHeight - lcMargin.bottom - lcMargin.top;
  const lcPlotWidth = lcWidth - lcMargin.left - lcMargin.right;

  const lcSvg = select('#line-chart')
    .append('svg')
    .attr('height', lcHeight)
    .attr('width', lcWidth)
    .append('g')
    .attr('transform', `translate(${lcMargin.left}, ${lcMargin.top})`);

  const lcXAxis = lcSvg
    .append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0, ${lcPlotHeight})`);

  const lcYAxis = lcSvg.append('g').attr('class', 'y-axis');

  lcSvg
    .append('g')
    .attr('class', 'x-axis-label')
    .attr('transform', `translate(${lcPlotWidth / 2}, ${lcHeight - 10})`)
    .append('text')
    .attr('text-anchor', 'middle')
    .text('Year');

  lcSvg
    .append('g')
    .attr('class', 'y-axis-label')
    .attr('transform', `translate(-40, ${lcPlotHeight / 2})`)
    .append('text')
    .attr('text-anchor', 'middle')
    .attr('transform', 'rotate(-90)')
    .text('Total Arrests');

  lcSvg.append('g').attr('class', 'line-container');

  lineChart(data, lcSvg, lcXAxis, lcYAxis, county, lcPlotWidth, lcPlotHeight);

  selectAll('.year-button').on('change', event => {
    const input = event.target.id;
    if (input === 'All Years') year = undefined;
    else year = +event.target.id;
    myMap(data, year, mapSvg, coProjection, tooltip, highlightCounty);
    myBarChart(
      data,
      year,
      county,
      rectContainer,
      bcXAxis,
      bcYAxis,
      bcPlotWidth,
      bcPlotHeight,
    );
  });

  selectAll('.map-path').on('click', (event, obj) => {
    county = obj.properties.county;
    highlightCounty = obj.properties.county;
    myBarChart(
      data,
      year,
      county,
      rectContainer,
      bcXAxis,
      bcYAxis,
      bcPlotWidth,
      bcPlotHeight,
    );
    lineChart(data, lcSvg, lcXAxis, lcYAxis, county, lcPlotWidth, lcPlotHeight);
    myMap(data, year, mapSvg, coProjection, tooltip, highlightCounty);
  });

  select('#county-reset').on('click', event => {
    county = undefined;
    highlightCounty = undefined;
    myBarChart(
      data,
      year,
      county,
      rectContainer,
      bcXAxis,
      bcYAxis,
      bcPlotWidth,
      bcPlotHeight,
    );
    lineChart(data, lcSvg, lcXAxis, lcYAxis, county, lcPlotWidth, lcPlotHeight);
    myMap(data, year, mapSvg, coProjection, tooltip, highlightCounty);
  });
}

function lineChart(data, svg, xAxis, yAxis, county, plotWidth, plotHeight) {
  const [arrests, mapData, population] = data;
  const t = transition().duration(500);

  const yearTotals = getYearTotals(
    arrests,
    'ArrestYear',
    'totalArrests',
    undefined,
    county,
  );
  const xDomain = extent(yearTotals, d => new Date(`01/01/${d.x}`));
  const yDomain = extent(yearTotals, d => d.y);

  const scaleFactor = (yDomain[1] - yDomain[0]) / 4;

  const xScale = scaleTime()
    .domain(xDomain)
    .range([0, plotWidth]);

  const yScale = scaleLinear()
    .domain([yDomain[0] - scaleFactor, yDomain[1] + scaleFactor])
    .range([plotHeight, 0]);

  const lineScale = line()
    .x(d => xScale(new Date(`01/01/${d.x}`)))
    .y(d => yScale(d.y));

  xAxis.call(axisBottom(xScale));

  yAxis.call(
    axisLeft(yScale)
      .tickSize(-plotWidth)
      .ticks(7),
  );

  select('.line-container')
    .selectAll('.arrest-trend')
    .data([yearTotals])
    .join(
      enter => enter.append('path').attr('d', d => lineScale(d)),
      update =>
        update.call(el => el.transition(t).attr('d', d => lineScale(d))),
    )
    .attr('class', 'arrest-trend')
    .attr('stroke', '#A31621')
    .attr('stroke-width', 3)
    .attr('fill', 'none');

  let titleCounty;
  if (!county) titleCounty = 'All Counties';
  else titleCounty = county;

  select('#line-chart-title')
    .select('h3')
    .remove();

  select('#line-chart-title')
    .append('h3')
    .text(`Yearly Arrest Totals for ${titleCounty}`);
}

function myBarChart(
  data,
  year,
  county,
  rectContainer,
  xAxis,
  yAxis,
  plotWidth,
  plotHeight,
) {
  const [arrests, mapData, population] = data;
  const t = transition().duration(500);

  const arrestPercent = getArrestPercent(arrests, year, county);
  let popCounty;
  if (!county) popCounty = 'STATEWIDE';
  else popCounty = county;
  const popPercent = getPopPercent(population, popCounty);
  const prepData = [popPercent, arrestPercent];

  const xDomain = extent(prepData, d => d.name);
  const yDomain = extent(prepData, d => d.percent);

  const xScale = scaleBand()
    .domain(xDomain)
    .range([0, plotWidth]);

  const yScale = scaleLinear()
    .domain([0, 0.28])
    .range([0, plotHeight]);

  rectContainer
    .selectAll('rect')
    .data(prepData)
    .join(
      enter =>
        enter
          .append('rect')
          .attr('y', d => plotHeight - yScale(d.percent))
          .attr('height', d => yScale(d.percent)),
      update =>
        update.call(el =>
          el
            .transition(t)
            .attr('y', d => plotHeight - yScale(d.percent))
            .attr('height', d => yScale(d.percent)),
        ),
    )
    .attr('x', d => xScale(d.name))
    .attr('width', xScale.bandwidth())
    .attr('fill', '#684551')
    .attr('stroke', 'white');

  xAxis.call(axisBottom(xScale));

  yAxis.call(axisLeft(yScale.range([plotHeight, 0])).tickFormat(format('.0%')));

  let yearTitle;
  if (year) yearTitle = year;
  else yearTitle = '2012-17';

  let countyTitle;
  if (county) countyTitle = county;
  else countyTitle = 'All Counties';

  select('#bar-chart-title')
    .select('h3')
    .remove();

  select('#bar-chart-title')
    .append('h3')
    .text(
      `Black Share of Arrests vs. Black Share of Population: ${countyTitle}, ${yearTitle}`,
    );
}

function myMap(data, year, svg, projection, tooltip, highlightCounty) {
  const [arrests, mapData, population] = data;
  const t = transition().duration(500);

  // const popTotals = new Map(
  //   population.map(obj => [obj.County.toUpperCase(), obj.totalPop]),
  // );

  let totals = getYearTotals(
    arrests,
    'County',
    'totalArrests',
    year,
    undefined,
  );
  const xDomain = extent(totals, d => d.y);
  totals = Object.assign(
    new Map(totals.map(obj => [obj.x.toUpperCase(), obj.y])),
  );

  const domainScale = Math.ceil(xDomain[1] / 5);

  const color = scaleQuantize(
    [xDomain[0], xDomain[1] - domainScale],
    schemeGreens[5],
  );

  const co_geoPath = geoPath(projection);

  select('#map-paths')
    .selectAll('path')
    .data(mapData.features)
    .join(
      enter =>
        enter.append('path').attr('fill', d => {
          return color(totals.get(d.properties.county))
            ? color(totals.get(d.properties.county))
            : '#B1B1BE';
        }),
      update =>
        update.call(el =>
          el
            .transition(t)
            .attr('fill', d =>
              color(totals.get(d.properties.county))
                ? color(totals.get(d.properties.county))
                : '#B1B1BE',
            ),
        ),
    )
    .on('mouseenter', (e, d) => {
      let countyName = d.properties.county.toLowerCase();
      countyName = countyName.charAt(0).toUpperCase() + countyName.slice(1);
      let arrestTotals = totals.get(d.properties.county);
      if (!arrestTotals) arrestTotals = 'No Data';
      tooltip
        .style('display', 'block')
        .style('left', `${e.layerX}px`)
        .style('top', `${e.layerY}px`)
        .text(`${countyName} : ${arrestTotals}`);

      select(e.target).attr('opacity', '30%');
    })
    .on('mouseleave', (e, d) => {
      tooltip.style('display', 'none');
      select(e.target).attr('opacity', '100%');
    })
    .attr('stroke', d => {
      if (d.properties.county === highlightCounty) return 'yellow';
      else return '#073B3A';
    })
    .attr('stroke-width', d => {
      if (d.properties.county === highlightCounty) return '2px';
      else return '0.5px';
    })
    .attr('d', co_geoPath)
    .attr('class', 'map-path');

  select('#map-legend')
    .select('svg')
    .remove();

  let legendYear;
  if (year) legendYear = year;
  else legendYear = `2012-2017`;
  select('#map-legend').append(() =>
    legend({
      color,
      title: `Total Arrests for ${legendYear}`,
      tickFormat: '.0f',
      width: 400,
    }),
  );
}
