

var keplerian_elms = {
    "mercury" : {"a":  0.38709927,     "e": 0.20563593,     "i": 7.00497902,     "L": 252.25032350,   "long_peri":  77.45779628,   "long_node":  48.33076593, "a_dot":  0.00000037,    "e_dot":  0.00001906,    "i_dot": -0.00594749,  "L_dot": 149472.67411175,    "long_peri_dot":  0.16047689,    "long_node_dot": -0.12534081},
    "venus"   : {"a":  0.72333566,     "e": 0.00677672,     "i": 3.39467605,     "L": 181.97909950,   "long_peri": 131.60246718,   "long_node":  76.67984255, "a_dot":  0.00000390,    "e_dot": -0.00004107,    "i_dot": -0.00078890,  "L_dot":  58517.81538729,    "long_peri_dot":  0.00268329,    "long_node_dot": -0.27769418},
    "em_barry": {"a":  1.00000261,     "e": 0.01671123,     "i":-0.00001531,     "L": 100.46457166,   "long_peri": 102.93768193,   "long_node":   0.00000000, "a_dot":  0.00000562,    "e_dot": -0.00004392,    "i_dot": -0.01294668,  "L_dot":  35999.37244981,    "long_peri_dot":  0.32327364,    "long_node_dot":  0.0       },
    "mars"    : {"a":  1.52371034,     "e": 0.09339410,     "i": 1.84969142,     "L":  -4.55343205,   "long_peri": -23.94362959,   "long_node":  49.55953891, "a_dot":  0.00001847,    "e_dot":  0.00007882,    "i_dot": -0.00813131,  "L_dot":  19140.30268499,    "long_peri_dot":  0.44441088,    "long_node_dot": -0.29257343},
    "jupiter" : {"a":  5.20288700,     "e": 0.04838624,     "i": 1.30439695,     "L":  34.39644051,   "long_peri":  14.72847983,   "long_node": 100.47390909, "a_dot": -0.00011607,    "e_dot": -0.00013253,    "i_dot": -0.00183714,  "L_dot":   3034.74612775,    "long_peri_dot":  0.21252668,    "long_node_dot":  0.20469106},
    "saturn"  : {"a":  9.53667594,     "e": 0.05386179,     "i": 2.48599187,     "L":  49.95424423,   "long_peri":  92.59887831,   "long_node": 113.66242448, "a_dot": -0.00125060,    "e_dot": -0.00050991,    "i_dot":  0.00193609,  "L_dot":   1222.49362201,    "long_peri_dot": -0.41897216,    "long_node_dot": -0.28867794},
    "uranus"  : {"a": 19.18916464,     "e": 0.04725744,     "i": 0.77263783,     "L": 313.23810451,   "long_peri": 170.95427630,   "long_node":  74.01692503, "a_dot": -0.00196176,    "e_dot": -0.00004397,    "i_dot": -0.00242939,  "L_dot":    428.48202785,    "long_peri_dot":  0.40805281,    "long_node_dot":  0.04240589},
    "neptune" : {"a": 30.06992276,     "e": 0.00859048,     "i": 1.77004347,     "L": -55.12002969,   "long_peri":  44.96476227,   "long_node": 131.78422574, "a_dot":  0.00026291,    "e_dot":  0.00005105,    "i_dot":  0.00035372,  "L_dot":    218.45945325,    "long_peri_dot": -0.32241464,    "long_node_dot": -0.00508664},
}

function get_radians(degrees)
{
  return degrees * (Math.PI/180);
}


function get_degrees(radians)
{
  return radians * (180/Math.PI);
}



function calc_kepler_estimates( timestamp, planet = "em_barry")
{
  
  let T = make_date(timestamp);

  let a = (keplerian_elms[planet]["a"] + keplerian_elms[planet]["a_dot"] * T) * 149_597_870.7;
  let e = keplerian_elms[planet]["e"] + keplerian_elms[planet]["e_dot"] * T;
  let i = get_radians(keplerian_elms[planet]["i"] + keplerian_elms[planet]["i_dot"] * T);
  let L = get_radians(keplerian_elms[planet]["L"] + keplerian_elms[planet]["L_dot"] * T);
  let long_peri = get_radians(keplerian_elms[planet]["long_peri"] + keplerian_elms[planet]["long_peri_dot"] * T);
  let long_node = get_radians(keplerian_elms[planet]["long_node"] + keplerian_elms[planet]["long_node_dot"] * T);

  
  let M_e = (L - long_peri) % (2 * Math.PI);
  let EPSILON = 0.00001;


  
  //Kepler's equation, to be used in a Newton solver.
  function kepler_func(E_x, M_e_x, e_x) //kepler function--- main function for newtonRaphson
  {    return E_x - e_x * Math.sin(E_x) - M_e_x; }

  /*The derivative of Kepler's equation, to be used in a Newton solver.
    Note that the argument M_e is unused, but must be present so the function
    arguments are consistent with the kepler function.*/
  function kepler_func_d_E(E_x, M_e_x, e_x)
  {    return 1 - e_x * Math.cos(E_x); }

  function newtonRaphson(guess) //root-finding function based on iterative derivatives
  {
      let h = kepler_func(guess, M_e, e) / kepler_func_d_E(guess, M_e, e);
      
      
      while (Math.abs(h) >= EPSILON)
      {
          //console.log("h: "  + String(Math.abs(h)) + "guess: "  + String(guess));
          h = kepler_func(guess, M_e, e) / kepler_func_d_E(guess, M_e, e);
          // x(i+1) = x(i) - f(x) / f'(x)
          guess = guess - h;
      }
      return guess;
  }


  let E = newtonRaphson(Math.PI);

  //console.log("Final root value = " +String(E));
  
  let nu = (2 * Math.atan(Math.sqrt((1 + e) / (1 - e)) * Math.tan(E / 2))) % (2 * Math.PI);

  //console.log("nu = " +String(nu));
  
  let omega = long_peri - long_node;

  let kepler_vars = {"distance": (a/149597870.691), "eccentricity": e, "inclination": get_degrees(i), "long_mean": get_degrees(nu), "long_peri": get_degrees(omega), "long_node": get_degrees(long_node)};


  //print(f"𝑎 = {a:.5G} km", f"𝑒 = {e:.5F}", f"𝑖 = {np.degrees(i):.2F}°", f"𝜃 = {np.degrees(nu):.2F}°",
   //     f"𝜔 = {np.degrees(omega):.2F}°", f"𝛺 = {np.degrees(long_node):.2F}°", sep="\n")
  

  //console.log(kepler_vars);
  return kepler_vars;
}

function make_date(timestamp)
{
  //let T_GRG = new Date(Date.UTC(2020, 11, 8, 21, 30, 0)); //year, month, day, hours, minutes, seconds, milliseconds


  let JDT = gregorian_to_julian_days_index(timestamp.getUTCFullYear(), timestamp.getUTCMonth()+1, timestamp.getUTCDate());
  return (JDT - 2451545) / 36525;
}


function gregorian_to_julian_days_index(year, month, day)
{
  
    //Convert the given proleptic Gregorian date to the equivalent Julian Day Number.
    if (month < 1 || month > 12)
      return alert("month must be between 1 and 12, inclusive " + String(month));
    if (day < 1 || day > 31)
      return alert("day must be between 1 and 31, inclusive " + String(day));
    let A = parseInt((month - 14) / 12);
    let B = 1461 * (year + 4800 + A);
    let C = 367 * (month - 2 - 12 * A);
    
    let E = parseInt((year + 4900 + A) / 100);
    let JDN = parseInt(B / 4) + parseInt(C / 12) - parseInt(3 * E / 4) + day - 32075;
    return JDN;
}


