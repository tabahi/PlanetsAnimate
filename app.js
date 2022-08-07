const { get } = require('http');
const https = require('https')
//references:
//https://ssd.jpl.nasa.gov/horizons/manual.html

const planet_codes = {"sun": '10', "moon": '301', "mercury": '199', "venus": '299', "earth": '399', "mars": "499", "jupiter": "599", "saturn": "699", "uranus": "799", "neptune": "899", "pluto": "999"};

function get_ep(target_body_code, center_body_code = '399', start_date='2022-01-01', end_date='2022-01-02', step_mins='10')
{
    return new Promise(function(resolve, reject) {


        let center_body_site = '500@'+center_body_code; //500 means body center site. @body or planet
        const options = {
            hostname: 'ssd.jpl.nasa.gov',
            port: 443,
            path: '/api/horizons.api?format=text&COMMAND=%27'+target_body_code+'%27&OBJ_DATA=%27No%27&MAKE_EPHEM=%27YES%27&EPHEM_TYPE=%27OBSERVER%27&CENTER=%27'+center_body_site+'%27&START_TIME=%27'+start_date+'%27&STOP_TIME=%27'+end_date+'%27&STEP_SIZE=%27'+step_mins+'%20min%27&QUANTITIES=%271,9,20,23,24,29%27',
            method: 'GET'
          }

          console.log(options.hostname + options.path);

        const req = https.request(options, res => {
            console.log(`statusCode: ${res.statusCode}`)
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
                else reject("Response incomplete or invalid");
            });
        })
        
        req.on('error', error => {
            reject(error);
        })
        
        req.end()
    });
}
var hold_data = {};
var target_body = "moon";

let ts_now = new Date();

planet_find("moon", "earth", ts_now);
//planet_find("moon", "earth", ts_now);

function planet_find(target_body, center_body, timestamp)
{
    if(hold_data[target_body] == undefined)
    hold_data[target_body] = {};
    
    timestamp.setYear(2020);
    timestamp.setMinutes(0);
    let exact_mins = timestamp.getUTCMinutes();
    let upper_mins = exact_mins + (10 - (exact_mins%10));
    let lower_mins = exact_mins - (exact_mins%10);

    timestamp.setSeconds(0); timestamp.setMilliseconds(0);
    let lo_ts = new Date(timestamp);
    let up_ts = new Date(timestamp);
    up_ts.setMinutes(upper_mins);
    lo_ts.setMinutes(lower_mins);

    
    //console.log(timestamp, up_ts);
    //console.log(timestamp, lo_ts);


    if((hold_data[target_body][String(up_ts.getTime())] == undefined) || (hold_data[target_body][String(lo_ts.getTime())] == undefined))
    {
        console.log("Missing data");
    }
    else
    {
        console.log("Has data");
    }
    if(up_ts.getUTCDate()==lo_ts.getUTCDate())  up_ts.setTime(up_ts.getTime() + 86400000);

    let up_date = String(up_ts.getUTCFullYear()) + '-' + String(up_ts.getUTCMonth()+1) + '-' + String(up_ts.getUTCDate());
    let lo_date = String(lo_ts.getUTCFullYear()) + '-' + String(lo_ts.getUTCMonth()+1) + '-' + String(lo_ts.getUTCDate());
    
    console.log(lo_date, up_date);
    

    get_ep(planet_codes[target_body], planet_codes[center_body], lo_date, up_date, '10').then(data => {
        
        lines = data.split("\n");

       
        
        
        for (let n=0; n<lines.length; n++)
        {
            tabs = lines[n].split(/[ ,]+/);
            //for (let t=0; t<tabs.length; t++) console.log(t, tabs[t]);
            if(tabs.length==17)
            {
                //console.log(lines[n], tabs.length);
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

                hold_data[target_body][String(obj.time.getTime())] = obj;
                //console.log(obj);
                //ts_steps.push(obj);
            }
            //else if(tabs.length> 1) console.error("#", lines[n]);
        }
        //console.log(hold_data);
    }

    ).catch(e=>{console.error(e); console.log("Done");})
}