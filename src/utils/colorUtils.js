import * as d3 from 'd3';

const nameColors = new Map();
const colorScale = d3.scaleOrdinal()
    .range([
        ...d3.schemePastel1,
        ...d3.schemePastel2,
        ...d3.schemeSet2,
        ...d3.schemeSet3,
    ]);

export function getColorForName(name) {
    if (!nameColors.has(name)) {
        nameColors.set(name, colorScale(name));
    }
    return nameColors.get(name);
}
