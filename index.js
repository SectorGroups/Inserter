exports.handler = async (event, context) => {
  console.log(event);
  console.log(context);

  // change to input param
  const inputData = JSON.parse(event.body);
  // const inputData = require('./input-data');

  const fs = require("fs");
  // const puppeteer = require('puppeteer');
  const chromium = require('chrome-aws-lambda');

  // import * as htmlparser2 from "htmlparser2"; 
  var htmlparser2 = require("htmlparser2");
  const cheerio = require('cheerio');

  // v2: change to input param
  const url = 'https://share.hsforms.com/1P75vRsyNTdSKleb72s-LYA32b7e';


  const browser = await chromium.puppeteer.launch({ 
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath,
    headless: chromium.headless,
    ignoreHTTPSErrors: true
  }); // for test disable the headlels mode,
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 926 });
  await page.goto(url,{waitUntil: 'networkidle2'});

  console.log("start evaluate javascript");

  const html = await page.content();
  // fs.writeFileSync("/tmp/index.html", html);

  browser.close();

  const newSource = html.replaceAll('#form-target', '#form-target2')
  const $ = cheerio.load(newSource);

  const parser = new htmlparser2.Parser({
      onopentag(name, attributes) {
          /*
          * This fires when a new tag is opened.
          *
          * If you don't need an aggregated `attributes` object,
          * have a look at the `onopentagname` and `onattribute` events.
          */
          try{
            if (name === "input" && attributes.type === "text") {
              $(`input[name=${attributes.name}]`).attr('value', inputData.properties[attributes.name].value);
            }else if (name === "input" && attributes.type === "email") {
              $(`input[name=${attributes.name}]`).attr('value', inputData.properties[attributes.name].value);
            }else if (name === "input" && attributes.type === "radio") {
              $(`input[name=${attributes.name}][value=${inputData.properties[attributes.name].value}]`).attr('checked', 'checked');
            }else if (name === "input" && attributes.type === "file") {
              $(`<img style="width: 200px" src="${inputData.properties[attributes.name].value}"/>`).insertAfter(`input[name=${attributes.name}]`);
            }else if (name === "input" && attributes.type === "checkbox") {
              var attrName = attributes.id.split('-input')[0];
              $(`input[name*=${attrName}][value=${inputData.properties[attrName].value}]`).attr('checked','checked');
            }else if (name === "textarea") {
              $(`textarea[name=${attributes.name}]`).text(inputData.properties[attributes.name].value);
            }else if (name === "select") {
              $(`select[name=${attributes.name}] option`).filter(function () { return $(this).text() == inputData.properties[attributes.name].value}).attr('selected', true);
            }
          }catch (e) {
            // console.log(e);
          }
         
      },
  });
  parser.write(
      newSource
  );
  parser.end();

  $('script').each((index, item) => {
    $(item).remove();
  });

  $('button[type="submit"]').remove();

  const outputHtml = $.html();
  fs.writeFileSync("/tmp/output.html", outputHtml);

  const browser2 = await chromium.puppeteer.launch({ 
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath,
    headless: chromium.headless,
    ignoreHTTPSErrors: true
  }); // for test disable the headlels mode,
    const page2 = await browser2.newPage();
  await page2.setViewport({ width: 1000, height: 926 });
  await page2.goto('file:///tmp/output.html',{waitUntil: 'networkidle2'});

  await page2.emulateMediaType('screen');
  const pdf2 = await page2.pdf({
    path: '/tmp/output.pdf',
    margin: { top: '50px', right: '20px', bottom: '50px', left: '20px' },
    printBackground: true,
    format: 'A4',
  });

  browser2.close();

  const AWS = require('aws-sdk');

  const s3 = new AWS.S3({
    accessKeyId: 'AKIATXPVXTXDPVJVIZUJ',
    secretAccessKey: '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'
  });

  const uploadFile = (data) => {
    console.log('Starting file upload')

    const params = {
      Bucket: 'sector-inserter', // pass your bucket name
      Key: 'output.html', // file will be saved as testBucket/contacts.csv
      Body: data,
      ContentType: 'text/html'
    };
    s3.upload(params, function (s3Err, data) {
      if (s3Err) throw s3Err
      console.log(`File uploaded successfully at ${data.Location}`)
        return {
          'statusCode': 200,
          'body': JSON.stringify(data.Location)
        }
    });
  };

  uploadFile(outputHtml);

  // return {
  //   'statusCode': 200,
  //   'body': response
  // }
}