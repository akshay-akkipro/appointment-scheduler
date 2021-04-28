var fs = require('fs');
const express = require('express');
const app = express();

const shell = require('shelljs');
var auth = require('basic-auth');

var bodyParser = require('body-parser');
var expressSession = require('express-session');

// vars for appointment scheduler
var appointmentStep = 20
var hospitalInfoMap = {}
var sendToCovid = false

app.use(bodyParser.urlencoded({ limit: '50mb', extended: false, parameterLimit: 500000000000000000 }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.text({ limit: '50mb' }));
app.use(expressSession({ secret: 'TIVot' }));

app.get('/', function(req, res){
   res.sendFile(__dirname + "/public/randomAbstracionAkkipro/screening.html");
});

app.get('/admin', function(req, res){
    res.sendFile(__dirname +'/public/randomAbstracionAkkipro/index.html');
});

app.get('/update', function(req,res) {
  shell.exec('update_git.bat')
  res.send("done")
});

app.get('/css/:filename', function (req, res) {
  filename = req.params.filename
  // console.log("css m,ang raga",filename)
  res.sendFile(__dirname + "/assets/css/" + filename)
});

app.get('/img/:filename', function (req, res) {
  filename = req.params.filename
  // console.log("image m,ang raga",filename)
  res.sendFile(__dirname + "/assets/img/" + filename)
});

app.post('/login', function(req,res) {
  // shell.exec('update_git.bat')
  var post = req.body
  console.log(post.user)
  console.log(post.password)
  if (post.user=='akshay' && post.password=='kumar'){ // HERE YOU WILL CALL A FUNCTION FOR AUTH WHICH WILL CHECK FOR IDS AND THEIR PASSWORD.
    req.session.user_id = post.user;
    req.session.pass = post.password;
    res.sendFile(__dirname + "/public/randomAbstracionAkkipro/testReceptionist.html")
  }
});

app.get('/login', function(req,res) {
  if (req.session.user_id=='akshay' && req.session.pass=='kumar'){ // HERE YOU WILL CALL A FUNCTION FOR AUTH WHICH WILL CHECK FOR IDS AND THEIR PASSWORD.
    res.sendFile(__dirname + "/public/randomAbstracionAkkipro/testReceptionist.html")
  }
})

app.get('/uploadStaffInfo', function(req, res){
  if (req.session.user_id =='akshay' && req.session.pass == 'kumar'){
    res.sendFile(__dirname +'/public/randomAbstracionAkkipro/uploadStaffInfo.html');
  }
});

app.get('/docsAvailable', function(req, res){
  if (req.session.user_id =='akshay' && req.session.pass == 'kumar'){
    if (Object.keys(hospitalInfoMap).length != 0){
      res.send(Object.keys(hospitalInfoMap));
    }else{
      res.send("404")
    }
  }
});


app.post('/submit',function(req,res){
  if (req.session.user_id =='akshay' && req.session.pass == 'kumar'){
    console.log(req.body)
  }
  console.log("submit")
})

app.post('/saveHospitalInfo',function(req,res){
    // console.log(req.body)
    body =  JSON.parse(req.body)
    csvContent = body['fileContent']
    result = csvJSON(csvContent)
    // console.log(result)
    createHospitalInfoMap(result)
    // console.log(hospitalInfoMap)

  res.send("Done")
})

app.post('/appointment',function(req,res){
    // console.log("screeningform")
    // console.log(req.body)
    symptomsArr = Object.keys(req.body)
    // console.log(symptomsArr)
    if(symptomsArr.includes('none')){
      res.sendFile(__dirname +'/public/randomAbstracionAkkipro/appointment.html');
    }else if (symptomsArr.length >=2 ){
      sendToCovid=true
      res.sendFile(__dirname + "/public/randomAbstracionAkkipro/apointmentInfo.html")

    }
})

///////
var appointmentTime = '404'
var formData = '404'
app.post('/appointmentStatus',function(req,res){
   
    // var appointmentTime = generateAppointment(req.body)
    // console.log("form data",req.body)
    appointmentTime=hospitalInfoMap[req.body['doctype']]['currentslot']
    formData=req.body
    updateApptime(req.body['doctype'])
    res.sendFile(__dirname + "/public/randomAbstracionAkkipro/apointmentInfo.html")
    // res.send("done")

    // res.sendFile(__dirname +'/public/randomAbstracionAkkipro/appointment.html');
})

app.get('/populateAppointmentCard',function(req,res){
  obj={}
  if (!sendToCovid){
    obj['appointmentTime']  =appointmentTime
    obj['form'] = formData
    appointmentTime = '404'
    formData = '404'
  }else{
    obj['sendToCovid']  = true
    sendToCovid = false
  }
    res.send(JSON.stringify(obj))
})

function updateApptime(doctype){
  if (hospitalInfoMap[doctype]['counter'] < parseInt(hospitalInfoMap[doctype]['count'])){
    hospitalInfoMap[doctype]['counter']=hospitalInfoMap[doctype]['counter']+1
    return
  } else {
    hospitalInfoMap[doctype]['counter'] = 1
  }

    var apptime = hospitalInfoMap[doctype]['currentslot']
    var apphrs = apptime.split(':')[0]
    var appmin = apptime.split(':')[1]

    if ((parseInt(appmin)+20) < 60 ){ appmin = parseInt(appmin)+20 } 
    else {appmin = parseInt(appmin)+20 %60; apphrs = parseInt(apphrs) +1}
    generatedtiming = apphrs+':'+appmin
    finalTiming = checkWokingHours(generatedtiming,doctype)
    // console.log(finalTiming,"finalTiming")
    hospitalInfoMap[doctype]['currentslot'] = finalTiming
}

function checkWokingHours(generatedtiming,doctype){
  

  workinghrs = hospitalInfoMap[doctype]['workTimings']
  currentslotindex=hospitalInfoMap[doctype]['currentslotindex']
  var arrworkingslots = workinghrs.split(' ')
  var fullhouse = false
  var pass = compareSlots(generatedtiming,arrworkingslots[hospitalInfoMap[doctype]['currentslotindex']])
  if (!pass){
    // console.log("pass clear nahi hua")
    for (var i = currentslotindex; i<arrworkingslots.length;i++){
      var pass1 = compareSlots(generatedtiming,arrworkingslots[i])
      // console.log("insside lopp pass", pass1)
      if (pass1){
        // console.log("breaking from pass for loop " ,i)
        hospitalInfoMap[doctype]['currentslotindex'] = i
        generatedtiming = arrworkingslots[i].split('-')[0]

        break
      }
      if (i == arrworkingslots.length-1 && !pass1){
        fullhouse = true
        return '404'
      }
    }
  }
  return generatedtiming
}

function compareSlots(generatedtiming,workingslots){
  var apphrs = parseInt(generatedtiming.split(':')[0])
  var appmin = parseInt(generatedtiming.split(':')[1])
  var slotEnd = workingslots.split('-')[1]
  var slothrs = parseInt(slotEnd.split(':')[0])
  var slotmin = parseInt(slotEnd.split(':')[1])
  // console.log("inside compareSlots",apphrs,appmin,slotEnd)
  if (slothrs<apphrs){return false}else if(slothrs==apphrs && slotmin<appmin){return false}else{return true}
}

function generateAppointment(formData){
   // console.log(formData,"inside generateAppointment")
   var d= new Date()
   var hrs = d.getHours()
   var min = d.getMinutes()

   var apptime = hospitalInfoMap[formData['doctype']]['currentslot']
   var apphrs = apptime.split(':')[0]
   var appmin = apptime.split(':')[1]

   if (apphrs <hrs){
    return hrs+':'+min
   } else if (apphrs <hrs && appmin<min){
    return hrs+':'+min
   } else {
    return apptime
   }
}

function createHospitalInfoMap(csvJSON){
  for (let i = 0; i < csvJSON.length; i++) {
    var obj = {}
    obj['count'] =csvJSON[i]['No of available docs']
    obj['workTimings'] = csvJSON[i]['workTimings']
    obj['counter'] = 1
    obj['currentslot'] = csvJSON[i]['workTimings'].split("-")[0]
    obj['currentslotindex']=0
    hospitalInfoMap[csvJSON[i]['Doc Speciality']] = obj
  }

}

function csvJSON(csvText) {
  let lines = [];
  const linesArray = csvText.split('\n');
  // for trimming and deleting extra space 

  for (let i = 0; i < linesArray.length; i++) {
    const row = linesArray[i].replace(/[\s]+[,]+|[,]+[\s]+/g, ',').trim();
    lines.push(row);
  }
  // for removing empty record
  lines.splice(lines.length - 1, 1);
  const result = [];
  const headers = lines[0].split(",");

  for (let i = 1; i < lines.length; i++) {
    const obj = {};
    const currentline = lines[i].split(",");

    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = currentline[j];
    }

    result.push(obj);
  }
  return result;
}

app.listen(8089);
console.log('server started localhost:8089')