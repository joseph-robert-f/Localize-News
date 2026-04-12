/**
 * Approximate center coordinates for known municipalities.
 * Key format: "Name|STATE" (exact match against MUNICIPAL_DIRECTORY entries).
 *
 * Used by import-directory.ts and backfill-coordinates.ts to populate
 * the latitude/longitude columns in the townships table.
 *
 * When the auto-expand cron adds new municipalities, coordinates are
 * initially NULL and can be backfilled by running:
 *   npx tsx scripts/backfill-coordinates.ts
 */
export const MUNICIPALITY_COORDINATES: Record<string, [number, number]> = {
  // Original seed townships
  "Springfield|IL":         [39.7817, -89.6501],
  "Naperville|IL":          [41.7508, -88.1535],
  "Shelbyville|IN":         [39.5214, -85.7769],
  "Ann Arbor|MI":           [42.2808, -83.7430],
  "Cheltenham Township|PA": [40.0640, -75.1321],

  // Midwest
  "Columbus|OH":            [39.9612, -82.9988],
  "Indianapolis|IN":        [39.7684, -86.1581],
  "Kansas City|MO":         [39.0997, -94.5786],
  "Minneapolis|MN":         [44.9778, -93.2650],
  "Omaha|NE":               [41.2565, -95.9345],
  "Des Moines|IA":          [41.5868, -93.6250],
  "Madison|WI":             [43.0731, -89.4012],
  "Grand Rapids|MI":        [42.9634, -85.6681],
  "Dearborn|MI":            [42.3223, -83.1763],
  "Evanston|IL":            [42.0451, -87.6877],
  "Bloomington|IN":         [39.1653, -86.5264],
  "Lansing|MI":             [42.7325, -84.5555],
  "Akron|OH":               [41.0814, -81.5190],
  "Toledo|OH":              [41.6639, -83.5552],
  "Cincinnati|OH":          [39.1031, -84.5120],
  "Cleveland|OH":           [41.4993, -81.6944],
  "Saint Paul|MN":          [44.9537, -93.0900],
  "Milwaukee|WI":           [43.0389, -87.9065],
  "St. Louis|MO":           [38.6270, -90.1994],
  "Wichita|KS":             [37.6872, -97.3301],
  "Lincoln|NE":             [40.8136, -96.7026],

  // Northeast
  "Boston|MA":              [42.3601, -71.0589],
  "Pittsburgh|PA":          [40.4406, -79.9959],
  "Providence|RI":          [41.8240, -71.4128],
  "Hartford|CT":            [41.7658, -72.6851],
  "Albany|NY":              [42.6526, -73.7562],
  "Buffalo|NY":             [42.8864, -78.8784],
  "Worcester|MA":           [42.2626, -71.8023],
  "Portland|ME":            [43.6591, -70.2568],
  "Burlington|VT":          [44.4759, -73.2121],
  "Stamford|CT":            [41.0534, -73.5387],
  "Syracuse|NY":            [43.0481, -76.1474],
  "Baltimore|MD":           [39.2904, -76.6122],
  "Newark|NJ":              [40.7357, -74.1724],
  "Jersey City|NJ":         [40.7178, -74.0431],
  "Wilmington|DE":          [39.7447, -75.5484],
  "Charleston|WV":          [38.3498, -81.6326],

  // South
  "Atlanta|GA":             [33.7490, -84.3880],
  "Nashville|TN":           [36.1627, -86.7816],
  "Charlotte|NC":           [35.2271, -80.8431],
  "Raleigh|NC":             [35.7796, -78.6382],
  "Durham|NC":              [35.9940, -78.8986],
  "Richmond|VA":            [37.5407, -77.4360],
  "Louisville|KY":          [38.2527, -85.7585],
  "Lexington|KY":           [38.0406, -84.5037],
  "Chattanooga|TN":         [35.0456, -85.3097],
  "Knoxville|TN":           [35.9606, -83.9207],
  "Birmingham|AL":          [33.5186, -86.8104],
  "Huntsville|AL":          [34.7304, -86.5861],
  "Little Rock|AR":         [34.7465, -92.2896],
  "Columbia|SC":            [34.0007, -81.0348],
  "New Orleans|LA":         [29.9511, -90.0715],
  "Baton Rouge|LA":         [30.4515, -91.1871],
  "Oklahoma City|OK":       [35.4676, -97.5164],
  "Tulsa|OK":               [36.1540, -95.9928],
  "Jackson|MS":             [32.2988, -90.1848],
  "Virginia Beach|VA":      [36.8529, -75.9780],
  "Norfolk|VA":             [36.8508, -76.2859],
  "Charleston|SC":          [32.7765, -79.9311],
  "Greenville|SC":          [34.8526, -82.3940],

  // West & Mountain
  "Denver|CO":              [39.7392, -104.9903],
  "Portland|OR":            [45.5051, -122.6750],
  "Seattle|WA":             [47.6062, -122.3321],
  "Boise|ID":               [43.6150, -116.2023],
  "Reno|NV":                [39.5296, -119.8138],
  "Eugene|OR":              [44.0521, -123.0868],
  "Fort Collins|CO":        [40.5853, -105.0844],
  "Boulder|CO":             [40.0150, -105.2705],
  "Spokane|WA":             [47.6588, -117.4260],
  "Tucson|AZ":              [32.2226, -110.9747],
  "Albuquerque|NM":         [35.0844, -106.6504],
  "Santa Fe|NM":            [35.6870, -105.9378],
  "Salt Lake City|UT":      [40.7608, -111.8910],
  "Phoenix|AZ":             [33.4484, -112.0740],
  "Mesa|AZ":                [33.4152, -111.8315],
  "Las Vegas|NV":           [36.1699, -115.1398],
  "Billings|MT":            [45.7833, -108.5007],
  "Cheyenne|WY":            [41.1400, -104.8202],
  "Honolulu|HI":            [21.3069, -157.8583],
  "Anchorage|AK":           [61.2181, -149.9003],

  // Texas & Florida
  "Houston|TX":             [29.7604, -95.3698],
  "San Antonio|TX":         [29.4241, -98.4936],
  "Dallas|TX":              [32.7767, -96.7970],
  "Austin|TX":              [30.2672, -97.7431],
  "Fort Worth|TX":          [32.7555, -97.3308],
  "El Paso|TX":             [31.7619, -106.4850],
  "Jacksonville|FL":        [30.3322, -81.6557],
  "Tampa|FL":               [27.9506, -82.4572],
  "Orlando|FL":             [28.5383, -81.3792],
  "St. Petersburg|FL":      [27.7676, -82.6403],
  "Tallahassee|FL":         [30.4518, -84.2807],

  // California
  "Los Angeles|CA":         [34.0522, -118.2437],
  "San Diego|CA":           [32.7157, -117.1611],
  "San Jose|CA":            [37.3382, -121.8863],
  "San Francisco|CA":       [37.7749, -122.4194],
  "Sacramento|CA":          [38.5816, -121.4944],
  "Oakland|CA":             [37.8044, -122.2712],
  "Long Beach|CA":          [33.7701, -118.1937],
  "Fresno|CA":              [36.7378, -119.7871],

  // Eastern & Central Pennsylvania — cities
  "Philadelphia|PA":        [39.9526, -75.1652],
  "Allentown|PA":           [40.6023, -75.4714],
  "Reading|PA":             [40.3356, -75.9269],
  "Scranton|PA":            [41.4090, -75.6624],
  "Bethlehem|PA":           [40.6259, -75.3705],
  "Lancaster|PA":           [40.0379, -76.3055],
  "Harrisburg|PA":          [40.2732, -76.8867],
  "York|PA":                [39.9626, -76.7277],
  "State College|PA":       [40.7934, -77.8600],
  "Wilkes-Barre|PA":        [41.2459, -75.8813],
  "Norristown|PA":          [40.1215, -75.3399],
  "Easton|PA":              [40.6884, -75.2207],
  "Lebanon|PA":             [40.3409, -76.4113],
  "Hazleton|PA":            [40.9584, -75.9746],
  "Chambersburg|PA":        [39.9370, -77.6611],
  "Pottstown|PA":           [40.2454, -75.6496],
  "Carlisle|PA":            [40.2015, -77.1886],
  "Pottsville|PA":          [40.6856, -76.1955],
  "Doylestown|PA":          [40.3101, -75.1299],
  "Stroudsburg|PA":         [40.9870, -75.1946],

  // Northampton County
  "Wind Gap|PA":            [40.8468, -75.3071],
  "Moore Township|PA":      [40.8279, -75.3218],
  "Nazareth|PA":            [40.7262, -75.3113],
  "Bath|PA":                [40.7273, -75.3924],
  "Pen Argyl|PA":           [40.8698, -75.2549],
  "Bangor|PA":              [40.8693, -75.2077],

  // Monroe County
  "East Stroudsburg|PA":    [41.0015, -75.1807],
  "Mount Pocono|PA":        [41.1220, -75.3588],
  "Pocono Township|PA":     [41.0529, -75.3399],

  // Carbon County
  "Jim Thorpe|PA":          [40.8773, -75.7349],
  "Palmerton|PA":           [40.7982, -75.6135],
  "Lansford|PA":            [40.8334, -75.8849],

  // Schuylkill County
  "Tamaqua|PA":             [40.7982, -75.9691],
  "Mahanoy City|PA":        [40.8126, -76.1397],
  "Shenandoah|PA":          [40.8198, -76.1994],
  "Minersville|PA":         [40.6912, -76.2638],

  // Luzerne & Lackawanna
  "Nanticoke|PA":           [41.2048, -76.0038],
  "Kingston|PA":            [41.2612, -75.8838],
  "Carbondale|PA":          [41.5734, -75.5024],
  "Dunmore|PA":             [41.4198, -75.6313],
  "Old Forge|PA":           [41.3723, -75.7338],

  // Suburban Philadelphia
  "West Chester|PA":        [39.9607, -75.6055],
  "Phoenixville|PA":        [40.1304, -75.5146],
  "Coatesville|PA":         [39.9832, -75.8227],
  "Lansdale|PA":            [40.2415, -75.2838],
  "Conshohocken|PA":        [40.0793, -75.3013],
  "Ambler|PA":              [40.1551, -75.2263],
  "Bristol|PA":             [40.1009, -74.8524],
  "Quakertown|PA":          [40.4415, -75.3413],
  "Kennett Square|PA":      [39.8459, -75.7132],
};
