const { get } = require('http');
const https = require('https')
fs = require('fs');
//references:
//https://ssd.jpl.nasa.gov/horizons/manual.html

const planet_names = ["sun",  "mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus" , "neptune", "pluto", "moon"];
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
            reject(error);
        })
        
        req.end()
        }
        
        send_horizon_req();
    });
}


let ts_now = new Date();

for (let pl=0; pl<=10; pl++)
    if(planet_names[pl]!=="earth")
    planet_find(planet_names[pl], "earth", ts_now);

    

function planet_find(target_body, center_body, timestamp)
{
    timestamp.setYear(2020);
    timestamp.setMinutes(56);
    let exact_mins = timestamp.getUTCMinutes();
    let upper_mins = exact_mins + (10 - (exact_mins%10));
    let lower_mins = exact_mins - (exact_mins%10);

    let up_prob = (exact_mins - lower_mins)/10;
    let lo_prob = (upper_mins - exact_mins)/10;
    console.log(lo_prob, up_prob, lo_prob + up_prob);


    timestamp.setSeconds(0); timestamp.setMilliseconds(0);
    let lo_ts = new Date(timestamp);
    let up_ts = new Date(timestamp);
    lo_ts.setMinutes(lower_mins);
    up_ts.setMinutes(upper_mins);

    //console.log(timestamp, up_ts);
    //console.log(timestamp, lo_ts);
    
    if(up_ts.getUTCDate()==lo_ts.getUTCDate())  up_ts.setTime(up_ts.getTime() + 86400000);

    let up_date = String(up_ts.getUTCFullYear()) + '-' + String(up_ts.getUTCMonth()+1) + '-' + String(up_ts.getUTCDate());
    let lo_date = String(lo_ts.getUTCFullYear()) + '-' + String(lo_ts.getUTCMonth()+1) + '-' + String(lo_ts.getUTCDate());
    

    ensure_epi_on_date(target_body, center_body, lo_date, up_date, String(lo_ts.getUTCFullYear())).then(json_data => {
        
        //console.log(json_data[String(lo_ts.getTime()/10000)]);
    }).catch(e=>{console.error(e); return;})
    
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

