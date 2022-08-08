var interval_id = null;
var canvasEle = document.getElementById('canvasEle');
var ctx = canvasEle.getContext("2d");
var center_x = 0;
var center_y = 0;
var max_radius = 0;
const max_AU = Math.sqrt(40);

var ts = new Date(2019, 0, 01, 2, 0, 0, 0);

var bodies = [
  {name: "sun",     color: "rgb(255,213,0)",      size: 5, au_factor: 1}, //0
  {name: "mercury", color: "rgb(153, 204, 255)",  size: 2,  au_factor: 1},
  {name: "venus",   color: "rgb(255, 102, 255)",  size: 3,  au_factor: 1},
  {name: "earth",   color: "rgb(0,150,50)",       size: 3,  au_factor: 1}, //3
  {name: "mars",    color: "rgb(255, 51, 0)",     size: 3,  au_factor: 1},
  {name: "jupiter", color: "rgb(204, 153, 0)",    size: 4,  au_factor: 1},
  {name: "saturn",  color: "rgb(153, 153, 102)",  size: 4,  au_factor: 1},
  {name: "uranus",  color: "rgb(0, 204, 255)",    size: 4,  au_factor: 1},
  {name: "neptune", color: "rgb(51, 51, 255)",    size: 4,  au_factor: 1},
  {name: "pluto",   color: "rgb(153, 0, 0)",      size: 2,  au_factor: 1}, //9
  {name: "moon",    color: "rgb(255,255,255)",    size: 1,  au_factor: 6}, //10
];

function init()
{
  reset_canvas();
  clearInterval(interval_id);
  interval_id = setInterval(animate_objects, 100);
}




function reset_canvas()
{
  const max_width = window.innerWidth - 10;
  const max_height = window.innerHeight - 10;
  max_radius = max_height;
  if(max_width < max_radius) max_radius = max_width;
  max_radius /= 2;
  center_x = max_width/2;
  center_y = max_height/2;


  canvasEle.width = max_width;
  canvasEle.height = max_height;
  
  ctx.clearRect(0, 0, max_width, max_height);

  ctx.fillStyle = "rgb(0, 13, 26)";
  ctx.beginPath();
  ctx.arc(center_x, center_y, max_radius, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.fill();
  //Earth for Geocentric
  add_object(center_x, center_y, bodies[3]["color"], 0, 0, bodies[3]["size"]);

  //Sun for Heliocentric
  //add_object(center_x, center_y, bodies[0]["color"], 0, 0, 20);
}





function animate_objects()
{
  let ts_ms = ts.getUTCMilliseconds() + 86400000;
  ts.setUTCMilliseconds(ts_ms);
  console.log(ts);
  //reset_canvas();
  //place_kepler_objects(ts);
  place_horizon_objects(ts);
}

function add_object(center_x, center_y, color="rgb(100,100,100)", angle=0, dist=20, size=10)
{
  //angle in degrees, dist = 0 to max_radius in px. size in px
  let radians = ((angle+180)/360)*-2*Math.PI;
  let x = dist * Math.cos(radians);
  let y = dist * Math.sin(radians);

  
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(center_x + x, center_y + y, size, 0, 2 * Math.PI);
  ctx.strokeStyle = "#353535";
  ctx.stroke();
  ctx.fill();
}

function place_horizon_objects(timestamp)
{
  for (let p=0; p<bodies.length; p++)
  {
    if(bodies[p]["name"]!="earth")
    get_horizon_epi(bodies[p]["name"], "earth", timestamp).then(epi_info => {

      add_object(center_x, center_y, bodies[p]["color"], epi_info["RA"], max_radius * (Math.sqrt(epi_info["au"])/max_AU) * bodies[p]["au_factor"], bodies[p]["size"]);
    }).catch(e=>{ console.error(e); console.log("ERROR: Ephemeris unavailable for this time for " + bodies[p]["name"]); clearInterval(interval_id); return;});

  }
}

get_horizon_epi("mercury", "earth", ts);

function get_horizon_epi(target_body, center_body="earth", timestamp=new Date())
{

  return new Promise(function(resolve, reject) {
  let ts_bounds = get_boundary_timestamps(timestamp);
  
  let ts_label = String(ts_bounds.lower.getTime()/10000);
  if(ts_bounds.upper.getUTCDate()==ts_bounds.lower.getUTCDate()) ts_bounds.upper.setTime(ts_bounds.upper.getTime() + 86400000);
  let lo_date = String(ts_bounds.lower.getUTCFullYear()) + '-' + String(ts_bounds.lower.getUTCMonth()+1) + '-' + String(ts_bounds.lower.getUTCDate());
  let up_date = String(ts_bounds.upper.getUTCFullYear()) + '-' + String(ts_bounds.upper.getUTCMonth()+1) + '-' + String(ts_bounds.upper.getUTCDate());

  //console.log(ts_bounds.lower, lo_date);
  //console.log(ts_bounds.upper, up_date);
  let epi_file_path = 'epi/' + String(ts_bounds.lower.getUTCFullYear()) + '/' + lo_date + '_' + up_date + '/' + target_body + '_' + center_body + '.json';

  fetch(epi_file_path)
  .then(response => response.json())
  .then(json_obj => {

    if(json_obj[ts_label]!==undefined)
    {
      //console.log(json_obj[ts_label]);
      let ephemeris_info = {};
      ephemeris_info["RA"] = concert_arcs_to_decimal(json_obj[ts_label][0], json_obj[ts_label][1], json_obj[ts_label][2]);
      ephemeris_info["au"] = json_obj[ts_label][8];
      ephemeris_info["au_dot"] = json_obj[ts_label][9];
      resolve(ephemeris_info);
    }
    else reject(console.error(ts_label + ' ts_label not found in JSON file ' + epi_file_path));
  
  }).catch(err => {reject(console.error(err));});
});
}

function get_boundary_timestamps(timestamp)
{
  //decimal boundaries... Because database is with 10 minutes steps
    let exact_mins = timestamp.getUTCMinutes();
    let upper_mins = exact_mins + (10 - (exact_mins%10));
    let lower_mins = exact_mins - (exact_mins%10);

    let up_prob = (exact_mins - lower_mins)/10;
    let lo_prob = (upper_mins - exact_mins)/10;


    timestamp.setSeconds(0); timestamp.setMilliseconds(0);
    let lo_ts = new Date(timestamp);
    let up_ts = new Date(timestamp);
    lo_ts.setMinutes(lower_mins);
    up_ts.setMinutes(upper_mins);
    return {lower: lo_ts, upper: up_ts, lower_prob: lo_prob, upper_prob: up_prob};
}

function concert_arcs_to_decimal(arc_deg, arc_min=0, arc_sec=0)
{
  return ((arc_deg*15) + (arc_min*0.25) + (arc_sec/240));
}

function place_kepler_objects(timestamp)
{
  
  for (let p=1; p<=8; p++)
  {
    let kepler_vars = calc_kepler_estimates(timestamp, bodies[p]["name"]);
    add_object(center_x, center_y, bodies[p]["color"], kepler_vars["long_mean"], max_radius * Math.sqrt(kepler_vars["distance"])/max_AU, bodies[p]["size"]);
  }
}


/*
function myMove() {
    

  var elem = document.getElementById("myAnimation");   
  var pos = 0;
  clearInterval(interval_id);
  interval_id = setInterval(frame, 10);
  function frame() {
    if (pos == 100) {
      clearInterval(interval_id);
    } else {
      pos++;
      
      elem.style.top = (((pos/200)*window.innerHeight) - 50)  + 'px'; 
      elem.style.left = (((pos/200)*window.innerWidth) - 50) + 'px'; 
    }
  }
}

*/