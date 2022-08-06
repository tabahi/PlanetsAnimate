var interval_id = null;
var canvasEle = document.getElementById('canvasEle');
var ctx = canvasEle.getContext("2d");
var center_x = 0;
var center_y = 0;
var max_radius = 0;

var ts = new Date(1991, 11, 08, 0, 0, 0, 0);


function init()
{
  reset_canvas();
  clearInterval(interval_id);
  interval_id = setInterval(animate_objects, 1000);
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
  //add_object(center_x, center_y, "rgb(0,150,50)", 0, 0, 10);

  //Sun for Heliocentric
  add_object(center_x, center_y, "rgb(255,213,0)", 0, 0, 20);
}

var bodies = [
  {name: "sun",     color: "rgb(255,213,0)",      size: 20, au_factor: 1}, //0
  {name: "mercury", color: "rgb(153, 204, 255)",  size: 3,  au_factor: 1},
  {name: "venus",   color: "rgb(255, 102, 255)",  size: 5,  au_factor: 1},
  {name: "em_barry",color: "rgb(0,150,50)",       size: 5,  au_factor: 1}, //3
  {name: "mars",    color: "rgb(255, 51, 0)",     size: 4,  au_factor: 1},
  {name: "jupiter", color: "rgb(204, 153, 0)",    size: 7,  au_factor: 1},
  {name: "saturn",  color: "rgb(153, 153, 102)",  size: 7,  au_factor: 1},
  {name: "uranus",  color: "rgb(0, 204, 255)",    size: 6,  au_factor: 1},
  {name: "neptune", color: "rgb(51, 51, 255)",    size: 6,  au_factor: 1},
  {name: "pluto",   color: "rgb(153, 0, 0)",      size: 4,  au_factor: 1}, //9
  {name: "moon",    color: "rgb(255,255,255)",    size: 4,  au_factor: 1}, //10
];



function animate_objects()
{
  let ts_ms = ts.getUTCMilliseconds() + 86400000;
  ts.setUTCMilliseconds(ts_ms);
  //console.log(ts);
 
  place_kepler_objects(ts);
}

function add_object(center_x, center_y, color="rgb(100,100,100)", angle=0, dist=20, size=10)
{
  let radians = ((angle+180)/360)*-2*Math.PI;
  let x = dist * Math.cos(radians);
  let y = dist * Math.sin(radians);

  
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(center_x + x, center_y + y, size, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.fill();
}


function place_kepler_objects(timestamp)
{
  let max_AU = Math.sqrt(40);
  
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