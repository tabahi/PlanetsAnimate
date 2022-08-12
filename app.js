const { get } = require('http');
const https = require('https');
const { exit } = require('process');
fs = require('fs');
//references:
//https://ssd.jpl.nasa.gov/horizons/manual.html

const planet_names = ["sun",  "mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus" , "neptune", "pluto", "moon"];
const planet_codes = {"sun": '10', "moon": '301', "mercury": '199', "venus": '299', "earth": '399', "mars": "499", "jupiter": "599", "saturn": "699", "uranus": "799", "neptune": "899", "pluto": "999"};


function download_ephemeris()
{

    let ts_now = new Date(1990, 0, 01, 2, 0, 0, 0);
    
    function chain_download()
    {
        console.log(ts_now);
        let all_await = [];
        
        for (let pl=0; pl<planet_names.length; pl++)
            if(planet_names[pl]!=="earth")
                all_await.push(planet_find(planet_names[pl], "earth", ts_now));
        
        Promise.all(all_await).then(results => {
            let ts_ms = ts_now.getUTCMilliseconds() + 86400000; //add a day
            ts_now.setUTCMilliseconds(ts_ms);
            if(ts_now.getUTCFullYear()!=2025) chain_download();
        }).catch((error) => {
            console.error(error);
            console.log(ts_now);
        });
        
    }
    chain_download();
}
download_ephemeris();



function planet_find(target_body, center_body, timestamp)
{
    return new Promise(function(resolve, reject) {
    
    let ts_bounds = get_boundary_timestamps(timestamp);

    //console.log(timestamp, ts_bounds.upper);
    //console.log(timestamp, ts_bounds.lower);
    
    if(ts_bounds.upper.getUTCDate()==ts_bounds.lower.getUTCDate()) ts_bounds.upper.setTime(ts_bounds.upper.getTime() + 86400000);
    let up_date = String(ts_bounds.upper.getUTCFullYear()) + '-' + String(ts_bounds.upper.getUTCMonth()+1) + '-' + String(ts_bounds.upper.getUTCDate());
    let lo_date = String(ts_bounds.lower.getUTCFullYear()) + '-' + String(ts_bounds.lower.getUTCMonth()+1) + '-' + String(ts_bounds.lower.getUTCDate());
    

    ensure_epi_on_date(target_body, center_body, lo_date, up_date, String(ts_bounds.lower.getUTCFullYear())).then(json_data => {
        
        //console.log(json_data[String(ts_bounds.lower.getTime()/10000)]);
        resolve(true);
    }).catch(e=>{ reject(e); return console.error(e);})
});
}


function get_ep(target_body_code, center_body_code = '399', start_date='2022-01-01', end_date='2022-01-02', step_mins='10')
{
    return new Promise(function(resolve, reject) {


        let center_body_site = '500@'+center_body_code; //500 means body center site. @body or planet
        const options = {
            hostname: 'ssd.jpl.nasa.gov',
            port: 443,
            path: '/api/horizons.api?format=text&COMMAND=%27'+target_body_code+'%27&OBJ_DATA=%27No%27&MAKE_EPHEM=%27YES%27&EPHEM_TYPE=%27OBSERVER%27&CENTER=%27'+center_body_site+'%27&START_TIME=%27'+start_date+'%27&STOP_TIME=%27'+end_date+'%27&STEP_SIZE=%27'+step_mins+'%20min%27&QUANTITIES=%271,9,20,23,24,29%27',
            method: 'GET'
          };
        let req_count = 0;
        //console.log(options.hostname + options.path);
        function send_horizon_req(){
        req_count++;
        const req = https.request(options, res => {
            //console.log(`statusCode: ${res.statusCode}`)

            if(res.statusCode==200)
            {
                let buff = "";
                let flag = 0;
                res.on('data', chunk => {
                //process.stdout.write(chunk)
                    if(flag == 0){
                        buff += chunk;
                        if(buff.indexOf("$$SOE")>=0)
                        {
                            buff = buff.slice(buff.indexOf("$$SOE")+5);
                            flag = 1;
                        }
                    }
                    if (flag == 1)
                    {
                        buff += chunk;
                        if(buff.indexOf("$$EOE")>=0)
                        {
                            flag = 2;
                            buff = buff.slice(0, buff.indexOf("$$EOE"));
                        }
                    }
                
                });
                res.on('end', () => {

                    if(flag==2) resolve(buff); 
                    else
                    setTimeout(() =>{
                        if(flag==2) resolve(buff);
                        else reject("Response incomplete or invalid. Link:\n" + options.hostname + options.path);
                    }, 2000);
                    
                });
            }
            else if(res.statusCode==503 && req_count<=5) setTimeout(send_horizon_req, 1100);
            else reject("Horizon API HTTP status code: " + res.statusCode + ' Link:\n' + options.hostname + options.path);
        })  
        
        req.on('error', error => {
            if( req_count<=10 ) {console.log("Horizon API TCP request failed. Will Retry soon. "+ error +"\nLink:\n" + options.hostname + options.path); setTimeout(send_horizon_req, 20000); }
            else reject("Horizon API TCP request failed. "+ error +"\nLink:\n" + options.hostname + options.path);
        });
        
        req.end();
        }
        
        send_horizon_req();
    });
}



function get_boundary_timestamps(timestamp)
{
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

function ensure_epi_on_date(target_body, center_body, lo_date, up_date, year_full)
{
    return new Promise(function(resolve, reject) {
    let date_dir = 'epi/' + year_full;
    try
    {
        if (!fs.existsSync(date_dir)) fs.mkdirSync(date_dir);
        date_dir += '/' + lo_date + '_' + up_date;
        try
        {
            if (!fs.existsSync(date_dir)) fs.mkdirSync(date_dir);
        }
        catch (err)
        {
            reject(err);
            return;
        }
    }
    catch (err)
    {
        reject(err);
        return;
    }

    let epi_file_path = 'epi/' + year_full + '/' + lo_date + '_' + up_date + '/' + target_body + '_' + center_body + '.json';

    function read_json_back()
    {
        fs.readFile(epi_file_path, 'utf8', (err, data) => {

            if (err) {
                reject(`Error reading file from disk: ${err}`); return;
            } else {
                let json_data = {};
                try{json_data = JSON.parse(data); resolve(json_data); return;}
                catch (err)
                {
                    reject(err);
                    console.log("Deleting corrupt file", epi_file_path);
                    fs.unlinkSync(epi_file_path);
                    return;
                }
            }
        });
    }
    
    if (!fs.existsSync(epi_file_path))
    {
        console.log("Downloading data for " + epi_file_path);
        get_ep(planet_codes[target_body], planet_codes[center_body], lo_date, up_date, '10').then(data => {
        
            lines = data.split("\n");
    
            let json_obj = {};
            
            
            for (let n=0; n<lines.length; n++)
            {
                tabs = lines[n].split(/[ ,]+/);
                
                if(tabs.length==17)
                {
                    //console.log(lines[n], tabs.length);
                    /*
                    let obj ={
                        time: new Date(tabs[1] + ' ' + tabs[2]),
    
                        RA_h: parseInt(tabs[3]),
                        RA_m: parseInt(tabs[4]),
                        RA_s: parseFloat(tabs[5]),
    
                        DEC_h: parseInt(tabs[6]),
                        DEC_m: parseInt(tabs[7]),
                        DEC_s: parseFloat(tabs[9]),
    
                        AMag: parseFloat(tabs[9]),
                        Sbrt: parseFloat(tabs[10]),
    
                        delta: parseFloat(tabs[11]),
                        deldot: parseFloat(tabs[12]),
    
                        
                        sot: parseFloat(tabs[13]),
                        sot_L: tabs[14],
                        STO: parseFloat(tabs[15]),
                        cnst: tabs[16],
                    };
                    */
                    let step_row = [
                        parseInt(tabs[3]),         //  RA_h
                        parseInt(tabs[4]),         // RA_m
                        parseFloat(tabs[5]),       // RA_s
                        parseInt(tabs[6]),         // DEC_h
                        parseInt(tabs[7]),         // DEC_m
                        parseFloat(tabs[9]),       //   DEC_s
                        parseFloat(tabs[9]),       //   AMag
                        parseFloat(tabs[10]),      //    Sbrt
                        parseFloat(tabs[11]),      //    delta
                        parseFloat(tabs[12]),      //    deldot
                        parseFloat(tabs[13]),      //    sot
                        tabs[14],                  //    sot_L
                        parseFloat(tabs[15]),      //    STO
                        tabs[16],                  //   cnst
                        //new Date(tabs[1] + ' ' + tabs[2]) // time UTC
                    ];

                    json_obj[String((new Date(tabs[1] + ' ' + tabs[2])).getTime()/10000)] = step_row;
                    //console.log(obj);
                    //ts_steps.push(obj);
                }
                //else if(tabs.length> 1) console.error("#", lines[n]);
            }
            
            //console.log(json_obj);
            fs.writeFile(epi_file_path, JSON.stringify(json_obj), function (err) {
                if (err) { reject(err); return console.error(err);}
                console.log('Saved to ' + epi_file_path);
                read_json_back();
            });
        }
    
        ).catch(e=>{reject(e); return;})
    }
    else read_json_back();
});
}


function save_json(filename, data)
{
    fs.writeFileSync(filename, data, function (err) {
      if (err) return console.log(err);
      console.log('Saved to ' + filename);
    });
}


/* Notes

Column meaning:
 
TIME

  Times PRIOR to 1962 are UT1, a mean-solar time closely related to the
prior but now-deprecated GMT. Times AFTER 1962 are in UTC, the current
civil or "wall-clock" time-scale. UTC is kept within 0.9 seconds of UT1
using integer leap-seconds for 1972 and later years.

  Conversion from the internal Barycentric Dynamical Time (TDB) of solar
system dynamics to the non-uniform civil UT time-scale requested for output
has not been determined for UTC times after the next July or January 1st.
Therefore, the last known leap-second is used as a constant over future
intervals.

  Time tags refer to the UT time-scale conversion from TDB on Earth
regardless of observer location within the solar system, although clock
rates may differ due to the local gravity field and no analog to "UT"
may be defined for that location.

  Any 'b' symbol in the 1st-column denotes a B.C. date. First-column blank
(" ") denotes an A.D. date. Calendar dates prior to 1582-Oct-15 are in the
Julian calendar system. Later calendar dates are in the Gregorian system.

  NOTE: "n.a." in output means quantity "not available" at the print-time.
 
 'R.A._____(ICRF)_____DEC' =
  Astrometric right ascension and declination of the target center with
respect to the observing site (coordinate origin) in the reference frame of
the planetary ephemeris (ICRF). Compensated for down-leg light-time delay
aberration.

  Units: RA  in hours-minutes-seconds of time,    HH MM SS.ff{ffff}
         DEC in degrees-minutes-seconds of arc,  sDD MN SC.f{ffff}
 
 'APmag   S-brt' =
  The targets' approximate apparent visual magnitude and surface brightness.
For planets and natural satellites, output is restricted to solar phase angles
covered by observational data. Outside the observed phase angle range, "n.a."
may be output to avoid extrapolation beyond the limit of model validity.

   For Earth-based observers, the estimated dimming due to atmospheric
absorption (extinction) is available as a separate, requestable quantity.

   Surface brightness is the average airless visual magnitude of a
square-arcsecond of the illuminated portion of the apparent disk. It is
computed only if the target radius is known.

   Units: MAGNITUDES & MAGNITUDES PER SQUARE ARCSECOND
 
 'delta      deldot' =
   Apparent range ("delta", light-time aberrated) and range-rate ("delta-dot")
of the target center relative to the observer. A positive "deldot" means the
target center is moving away from the observer, negative indicates movement
toward the observer.  Units: AU and KM/S
 
 'S-O-T /r' =
   Sun-Observer-Target apparent SOLAR ELONGATION ANGLE seen from the observers'
location at print-time.

   The '/r' column provides a code indicating the targets' apparent position
relative to the Sun in the observers' sky, as described below:

   Case A: For an observing location on the surface of a rotating body, that
body rotational sense is considered:

    /T indicates target TRAILS Sun   (evening sky: rises and sets AFTER Sun)
    /L indicates target LEADS Sun    (morning sky: rises and sets BEFORE Sun)

   Case B: For an observing point that does not have a rotational model (such
as a spacecraft), the "leading" and "trailing" condition is defined by the
observers' heliocentric ORBITAL motion:

    * If continuing in the observers' current direction of heliocentric
       motion would encounter the targets' apparent longitude first, followed
       by the Sun's, the target LEADS the Sun as seen by the observer.

    * If the Sun's apparent longitude would be encountered first, followed
       by the targets', the target TRAILS the Sun.

   Two other codes can be output:
    /* indicates observer is Sun-centered    (undefined)
    /? Target is aligned with Sun center     (no lead or trail)

   The S-O-T solar elongation angle is numerically the minimum separation
angle of the Sun and target in the sky in any direction. It does NOT indicate
the amount of separation in the leading or trailing directions, which would
be defined along the equator of a spherical coordinate system.

   Units: DEGREES
 
 'S-T-O' =
   The Sun-Target-Observer angle; the interior vertex angle at target center
formed by a vector from the target to the apparent center of the Sun (at
reflection time on the target) and the apparent vector from target to the
observer at print-time. Slightly different from true PHASE ANGLE (requestable
separately) at the few arcsecond level in that it includes stellar aberration
on the down-leg from target to observer.  Units: DEGREES
 
 'Sky_motion  Sky_mot_PA  RelVel-ANG' =
  Total apparent angular rate of the target in the plane-of-sky. "Sky_mot_PA"
is the position angle of the target's direction of motion in the plane-of-sky,
measured counter-clockwise from the apparent of-date north pole direction.
"RelVel-ANG" is the flight path angle of the target's relative motion with
respect to the observer's line-of-sight, in the range [-90,+90], where positive
values indicate motion away from the observer, negative values are toward the
observer:

  -90 = target is moving directly toward the observer
    0 = target is moving at right angles to the observer's line-of-sight
  +90 = target is moving directly away from the observer

UNITS:  ARCSECONDS/MINUTE, DEGREES, DEGREES
 
 'Lun_Sky_Brt  sky_SNR' =
  Sky brightness due to moonlight scattered by Earth's atmosphere at the
target's position in the sky. "sky_SNR" is the visual signal-to-noise ratio
(SNR) of the target's surface brightness relative to background sky. Output
only for topocentric Earth observers when both the Moon and target are above
the local horizon and the Sun is in astronomical twilight (or further) below
the horizon, and the target is not the Moon or Sun. If all conditions are
not met, "n.a." is output. Galactic brightness, local sky light-pollution
and weather are NOT considered. Lunar opposition surge is considered. The
value returned is accurate under ideal conditions at the approximately 8-23%
level, so is a useful but not definitive value.

  If the target-body radius is also known, "sky_SNR" is output. This is the
approximate visual signal-to-noise ratio of the target's brightness divided
by lunar sky brightness. When sky_SNR < 1, the target is dimmer than the
ideal moonlight-scattering background sky, so unlikely to be detectable at
visual wavelengths. In practice, visibility requires sky_SNR > 1 and a
detector sensitive enough to reach the target's magnitude, even if it isn't
washed out by moonlight. When relating magnitudes and brightness values,
keep in mind their logarithmic relationship m2-m1 = -2.5*log_10(b2/b1).

  UNITS: VISUAL MAGNITUDES / ARCSECOND^2, and unitless ratio

Computations by ...

    Solar System Dynamics Group, Horizons On-Line Ephemeris System
    4800 Oak Grove Drive, Jet Propulsion Laboratory
    Pasadena, CA  91109   USA

    General site: https://ssd.jpl.nasa.gov/
    Mailing list: https://ssd.jpl.nasa.gov/email_list.html
    System news : https://ssd.jpl.nasa.gov/horizons/news.html
    User Guide  : https://ssd.jpl.nasa.gov/horizons/manual.html
    Connect     : browser        https://ssd.jpl.nasa.gov/horizons/app.html#/x
                  API            https://ssd-api.jpl.nasa.gov/doc/horizons.html
                  command-line   telnet ssd.jpl.nasa.gov 6775
                  e-mail/batch   https://ssd.jpl.nasa.gov/ftp/ssd/hrzn_batch.txt
                  scripts        https://ssd.jpl.nasa.gov/ftp/ss

*/

