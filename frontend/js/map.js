const MapModule = (() => {
  let map = null;
  let geojsonLayer = null;
  let markerLayer = null;


  const BOROUGH_COLORS = {
    'Manhattan':    '#00D4FF',
    'Brooklyn':     '#F59E0B',
    'Queens':       '#10B981',
    'Bronx':        '#8B5CF6',
    'Staten Island':'#EF4444',
    'EWR':          '#6B7280',
    'Unknown':      '#374151',
    'N/A':          '#374151',
  };

  function getColor(borough) {
    return BOROUGH_COLORS[borough] || '#374151';
  }

  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function initMap(containerId = 'map') {
    if (map) { map.remove(); map = null; }

    map = L.map(containerId, {
      center: [40.7128, -74.006],
      zoom: 11,
      zoomControl: false,
    });


    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO',
      maxZoom: 18,
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    markerLayer = L.layerGroup().addTo(map);

    return map;
  }

  async function renderZones(zoneStats = {}) {
    if (!map) return;

    try {

      const resp = await fetch('/api/zones/geojson').catch(() => null);
      if (!resp || !resp.ok) {
        console.warn('GeoJSON not accessible – showing borough markers instead');
        renderBoroughMarkers();
        return;
      }

      const geojson = await resp.json();

      if (geojsonLayer) { map.removeLayer(geojsonLayer); }

      geojsonLayer = L.geoJSON(geojson, {
        style: feature => {
          const props   = feature.properties || {};
          const borough = props.borough || props.Borough || 'Unknown';
          const locId   = props.location_id || props.LocationID;
          const stat    = zoneStats[locId] || {};
          // Higher trip count = more opaque fill (capped at 5000 trips)
          const intensity = stat.trips ? Math.min(stat.trips / 5000, 1) : 0.15;

          const color = getColor(borough);
          return {
            fillColor:   color,
            fillOpacity: 0.12 + intensity * 0.45,
            color:       color,
            weight:      0.8,
            opacity:     0.5,
          };
        },
        onEachFeature: (feature, layer) => {
          const props   = feature.properties || {};
          const borough = props.borough || props.Borough || 'Unknown';
          const zone    = props.zone    || props.Zone    || 'Unknown Zone';
          const locId   = props.location_id || props.LocationID;
          const stat    = zoneStats[locId] || {};

          layer.bindTooltip(`
            <div style="font-family:'Inter',sans-serif;font-size:12px;line-height:1.5;color:#e8edf5;background:#0d1424;border:1px solid #1e2d4a;padding:10px 12px;border-radius:8px;min-width:160px">
              <div style="font-weight:600;margin-bottom:4px">${zone}</div>
              <div style="color:#8892a4;font-size:11px">${borough}</div>
              ${stat.trips ? `<div style="margin-top:6px;color:#00D4FF;font-size:11px">${stat.trips.toLocaleString()} trips</div>` : ''}
              ${stat.revenue ? `<div style="color:#F59E0B;font-size:11px">$${stat.revenue.toLocaleString(undefined,{maximumFractionDigits:0})}</div>` : ''}
            </div>
          `, { sticky: true, className: 'map-tooltip' });

          layer.on({
            mouseover: e => { e.target.setStyle({ fillOpacity: e.target.options.fillOpacity + 0.2, weight: 1.5 }); },
            mouseout:  e => { geojsonLayer.resetStyle(e.target); },
          });
        },
      }).addTo(map);

    } catch (err) {
      console.error('GeoJSON render error:', err);
      renderBoroughMarkers();
    }
  }


  // Fallback when GeoJSON fails to load
  function renderBoroughMarkers() {
    const boroughs = [
      { name: 'Manhattan',     lat: 40.7831, lng: -73.9712, trips: 0 },
      { name: 'Brooklyn',      lat: 40.6782, lng: -73.9442, trips: 0 },
      { name: 'Queens',        lat: 40.7282, lng: -73.7949, trips: 0 },
      { name: 'Bronx',         lat: 40.8448, lng: -73.8648, trips: 0 },
      { name: 'Staten Island', lat: 40.5795, lng: -74.1502, trips: 0 },
    ];

    boroughs.forEach(b => {
      const color = getColor(b.name);
      L.circleMarker([b.lat, b.lng], {
        radius: 22,
        fillColor: color,
        fillOpacity: 0.2,
        color: color,
        weight: 2,
        opacity: 0.7,
      })
        .bindPopup(`<b>${b.name}</b>`)
        .addTo(markerLayer);
    });
  }


  function plotHotspots(hotspots) {
    if (!map || !markerLayer) return;
    markerLayer.clearLayers();

    hotspots.forEach(h => {
      if (!h.lat || !h.lng) return;
      const radius = Math.max(6, Math.min(24, (h.trips / 500)));
      const color  = getColor(h.borough);

      L.circleMarker([h.lat, h.lng], {
        radius,
        fillColor:   color,
        fillOpacity: 0.7,
        color:       '#fff',
        weight:      1,
        opacity:     0.9,
      })
        .bindPopup(`
          <div style="font-family:'Inter',sans-serif;font-size:12px">
            <b>${h.zone}</b><br>
            <span style="color:#8892a4">${h.borough}</span><br>
            ${h.trips.toLocaleString()} trips
          </div>
        `)
        .addTo(markerLayer);
    });
  }

  function flyTo(lat, lng, zoom = 13) {
    if (map) map.flyTo([lat, lng], zoom, { duration: 1.2 });
  }

  function getMap() { return map; }

  return { initMap, renderZones, plotHotspots, flyTo, getMap, BOROUGH_COLORS };
})();