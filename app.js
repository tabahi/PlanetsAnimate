const https = require('https')




function get_ep(step_mins='60', start_date='2022-01-01', end_date='2022-01-02')
{
    return new Promise(function(resolve, reject) {
        const options = {
            hostname: 'ssd.jpl.nasa.gov',
            port: 443,
            path: '/api/horizons.api?format=text&COMMAND=%27499%27&OBJ_DATA=%27No%27&MAKE_EPHEM=%27YES%27&EPHEM_TYPE=%27OBSERVER%27&CENTER=%27500@399%27&START_TIME=%27'+start_date+'%27&STOP_TIME=%27'+end_date+'%27&STEP_SIZE=%27'+step_mins+'%20min%27&QUANTITIES=%271,9,20,23,24,29%27',
            method: 'GET'
          }

          

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

get_ep().then(data => {
    
    lines = data.split("\n");
    for (let n=0; n<lines.length; n++)
    {
        tabs = lines[n].split(/[ ,]+/);
        //for (let t=0; t<tabs.length; t++) console.log(t, tabs[t]);
        if(tabs.length==17)
        {
            console.log(lines[n], tabs.length);
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

            console.log(obj);

            
        }
        else if(tabs.length> 1) console.error("Invalid entry", lines[n]);
        
    }
}

).catch(e=>{console.error(e); console.log("Done");})


