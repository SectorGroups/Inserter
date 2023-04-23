exports.handler = async (event, context) => {

// const main = async (event, context) => { // USED FOR LOCAL DEV
  console.log("starting now...");

  const replaceSpecialChars = (issueString) => {
    return String(issueString).replace(/’/g, "'").replace(/”/g, "\"");
  }

  const { DateTime } = require("luxon");

  const inputData = JSON.parse(event.body.toString('utf-8'));
  // console.log(inputData);
  // const inputData = require('./input-data'); // USED FOR LOCAL DEV

  // const fs = require("fs");
  // const puppeteer = require('puppeteer'); // USED FOR LOCAL DEV
  const chromium = require('chrome-aws-lambda');

  var htmlparser2 = require("htmlparser2");
  const cheerio = require('cheerio');

  const url = inputData['form-submissions'][0]['page-url'];
  // const url = 'https://share.hsforms.com/1P75vRsyNTdSKleb72s-LYA32b7e'; // USED FOR LOCAL DEV??

  const browser = await chromium.puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath,
    headless: chromium.headless,
    ignoreHTTPSErrors: true
  });
  // USED FOR LOCAL DEV
  // const browser = await puppeteer.launch({
  //   args: puppeteer.args,
  //   defaultViewport: puppeteer.defaultViewport,
  //   headless: true,
  //   ignoreHTTPSErrors: true
  // });

  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 926 });
  await page.goto(url,{waitUntil: 'networkidle2'});

  let html = await page.content();

  // iterate through radio butttons and click yes/no 
  await page.waitForSelector('input[type=radio]');

  const elementSelector = 'input[type=radio]';
  const clickIds = await page.$$eval(elementSelector, (uiElement) => {
    return uiElement.map(option => option.id);
  });
  const elementSelector3 = '.hs-form__field-row';
    const clickIds3 = await page.$$eval(elementSelector3, (uiElement) => {
      return uiElement.map(option => option.id);
    });
  var numRows = clickIds3.length;

  console.log("logging");

  const positiveClickIds = [];

  for (let index = 0; index < clickIds.length; index++) {
    const element = clickIds[index];

    const select = '#' + element;
    await page.evaluate((select) => document.querySelector(select).click(), select); 
 
    const elementSelector2 = '.hs-form__field-row';
    const clickIds2 = await page.$$eval(elementSelector2, (uiElement) => {
      return uiElement.map(option => option.id);
    });
    
    if(numRows < clickIds2.length){
      positiveClickIds.push(element);
      numRows = clickIds2.length;
    }else if(numRows > clickIds2.length){
      numRows = clickIds2.length;
    }
  }

  console.log(positiveClickIds);

  const pageNew = await browser.newPage();
  await pageNew.setViewport({ width: 1000, height: 926 });
  await pageNew.goto(url,{waitUntil: 'networkidle2'});

  // iterate through radio butttons and click yes/no 
  await pageNew.waitForSelector('input[type=radio]');

  for (let index = 0; index < positiveClickIds.length; index++) {
    const element = positiveClickIds[index];

    const select = '#' + element;
    await pageNew.evaluate((select) => document.querySelector(select).click(), select); 
    
  }

  html = await pageNew.content();

  browser.close();

  const newSource = html.replaceAll('#form-target', '#form-target2')
  const $ = cheerio.load(newSource);

  const parser = new htmlparser2.Parser({
      onopentag(name, attributes) {
        const targetAttributeName = attributes.name
          try{
            if (name === "input" && attributes.type === "text") {
              if (attributes.inputmode === "numeric") {
                // $(`input[name=${attributes.name}]`).attr('value', `'${parseInt(inputData.properties[attributes.name].value)}'`);
                const newAttrName = targetAttributeName.split('__')[0]
                const val = inputData.properties[newAttrName].value
                const parsedDate = DateTime.fromMillis(parseInt(val));

                // parse out date fields if input is separated
                if (targetAttributeName.includes('DD')) {
                  $(`input[name=${targetAttributeName}]`).attr('value', `${parseInt(parsedDate.day)}`);
                } else if (targetAttributeName.includes('MM')) {
                  $(`input[name=${targetAttributeName}]`).attr('value', `${parseInt(parsedDate.month)}`);
                } else if (targetAttributeName.includes('YYYY')) {
                  $(`input[name=${targetAttributeName}]`).attr('value', `${parseInt(parsedDate.year)}`);
                } else {
                  $(`input[name=${targetAttributeName}]`).attr('value', `'${parseInt(inputData.properties[targetAttributeName].value)}'`);
                }
              } else {
                const str = replaceSpecialChars(inputData.properties[targetAttributeName].value)
                $(`input[name=${targetAttributeName}]`).attr('value', str);
              }
            } else if (name === "input" && attributes.type === "tel") {
              $(`input[name=${targetAttributeName}]`).attr('value', inputData.properties[targetAttributeName].value);
            }
            else if (name === "input" && attributes.type === "email") {
              $(`input[name=${targetAttributeName}]`).attr('value', inputData.properties[targetAttributeName].value);
            }else if (name === "input" && attributes.type === "radio") {
              const contentToInject = replaceSpecialChars(inputData.properties[targetAttributeName].value)
              $(`input[name=${targetAttributeName}][value='${contentToInject}']`).attr('checked', 'checked');

            }else if (name === "input" && attributes.type === "file") {
              const inputBtn = `input[name=${targetAttributeName}]`
              // console.log(inputBtn); 
              const input = $(inputBtn);
              input.parent().addClass('print-cleanup');
              input.attr('style', 'color: transparent;');
              input.attr('onchange', 'onChangeInput(event)');

              const ele = `${targetAttributeName}_container`;
              $(`<div id="${ele}_upload" style="display:flex; flex-direction:column; gap: 15px; width:fit-content;"><div id="${ele}" style="display:flex; flex-direction:column; width:fit-content;"><button id="remove-img-button" type="button" onclick="removeImage(${ele})">Remove</button><img style="width: 200px;" id="${ele}_img" src="${inputData.properties[targetAttributeName].value}"/></div>`).insertAfter(inputBtn);
            }else if (name === "input" && attributes.type === "checkbox") {
              if(attributes.name.indexOf("-") === -1){
                if(inputData.properties[attributes.name].value.includes("Yes")){
                  $(`input[name='${attrName}']`).attr('checked','checked');
                }
              }else{
                var attrNameVal = attributes.name.split('-')[1];
                var attrNameName = attributes.name.split('-')[0];
                var attrName = attributes.name;
                if(inputData.properties[attrNameName].value.includes(attrNameVal)){
                  $(`input[name='${attrName}']`).attr('checked','checked');
                }
              }
            }else if (name === "textarea") {
              const str = replaceSpecialChars(inputData.properties[targetAttributeName].value)
              $(`textarea[name=${targetAttributeName}]`).text(str);
            }else if (name === "select") {
              $(`select[name=${targetAttributeName}] option`).filter(function () { return $(this).text() == inputData.properties[targetAttributeName].value}).attr('selected', true);
            }
          }catch (e) {
            console.log(e);
          }
      },
      decodeEntities: true
  });
  parser.write(
      newSource
  );
  parser.end();

  $('script').each((index, item) => {
    $(item).remove();
  });

  $('span').each((index, item) => {
    const name = $(item).text();
    value = replaceSpecialChars(name)
    return $(item).text(value);
  });

  $('h5').each((index, item) => {
    const name = $(item).text();
    value = replaceSpecialChars(name)
    return $(item).text(value);
  });

  $('button[type="submit"]').remove();
  $('<div class="sector-actions"><img width="120px" src="https://www.sectorgrowth.ca/hubfs/Heading%20(500%20%C3%97%20200%20px)%20(700%20%C3%97%20350%20px)%20(200%20%C3%97%20100%20px).svg"><button id="print-button" class="button-36" type="button" onclick="saveImage()" style="display:none;">Save Image</button><button class="button-36" id="print-button" type="button" onclick="printPDF()">Print PDF</button></div>').prependTo('main[id="main"]');
  $('input[id="add_photo-input"]').attr('id')
  $('input[id="add_photo-input"]').attr('sectorName', 'add_photo-input')
  $('div[id=form-target]').attr('style', 'margin: 50px')
  $('head').append(`<meta charset="utf-8" />`);
  $('head').append(`<style type="text/css">
  .sector-actions {
    display: flex;
    flex-direction: row;
    position: fixed;
    top: 0;
    width: 100%;
    justify-content: center;
    background-color: white;
    box-shadow: rgba(100, 100, 111, 0.2) 0px 7px 29px 0px;
    align-items: center;
  }
  .sector-actions img {
    margin-right: 300px;
  }

  .sector-actions button {
    margin: 10px;
    height: 32px;
  }

  .button-mod {
    background-image: linear-gradient(92.88deg, #032d2d 9.16%, #265497 43.89%, #0066ec 64.72%) !important;
  }

  select.is-placeholder {
    color: black;
  }

  .button-36 {
    background-image: linear-gradient(92.88deg, #28bbc1 9.16%, #265497 43.89%, #276fce 64.72%);
    border-radius: 58px;
    border-style: none;
    box-sizing: border-box;
    color: #FFFFFF;
    cursor: pointer;
    flex-shrink: 0;
    font-family: "Inter UI","SF Pro Display",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen,Ubuntu,Cantarell,"Open Sans","Helvetica Neue",sans-serif;
    font-weight: 500;
    height: 4rem;
    padding: 0 1.6rem;
    text-align: center;
    text-shadow: rgba(0, 0, 0, 0.25) 0 3px 8px;
    transition: all .5s;
    user-select: none;
    -webkit-user-select: none;
    touch-action: manipulation;
  }

  .button-36:hover {
    box-shadow: rgba(80, 63, 205, 0.5) 0 1px 30px;
    transition-duration: .1s;
  }

  @media (min-width: 768px) {
    .button-36 {
      padding: 0 2.6rem;
    }
  }

  .container {
    margin-top: 90px !important;
  }

  #add_photo_container_uploadedImage {

  }

  @media print {
    div {
      break-inside: avoid;
    }
    .print-cleanup label {
      display: none;
    }
    .print-cleanup input {
      display: none;
    }
    .print-cleanup button {
      display: none;
    }
    .sector-actions {
      display: none;
    }
  }
  </style>`);
  $(`
  <script type="text/javascript">
  function debugBase64(base64URL){
      var win = window.open();
      win.document.write('<iframe src="' + base64URL  + '" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>');
  }

  function saveImage() {
    const domElement = document.querySelector("html");
    const markup = document.documentElement.innerHTML;
    const markupOutput = encodeURI(markup);
    console.log(markupOutput)
    // return

    // html2canvas(domElement, {allowTaint: true, useCORS: true}).then((canvas) => {
    //     const base64image = canvas.toDataURL("image/png");
    //     // debugBase64(base64image);
    //     // window.location.href = base64image;
    //     console.log(base64image)
    //     // window.open('', base64image);
    //     // const imgContainer = document.createElement("img")
    //     // imgContainer.width = "300";
    //     // imgContainer.height = "auto";
    //     // imgContainer.src = base64image;
    //     // const sectorActionsContainer = document.getElementsByClassName("sector-actions");
    //     // sectorActionsContainer[0].appendChild(imgContainer)
    // });
  }
  function printPDF(){
    window.print();
  }
  function removeImage(imageId) {
    console.log('Removing image: ', imageId)
    if (HTMLCollection.prototype.isPrototypeOf(imageId)) {
      for (var img of imageId) {
        img.remove();
      }
    } else {
      imageId.remove()

    }


  }
  function onChangeInput(event) {
    // console.log('onChangeInput(): ', event)
    console.log(event.srcElement.id)
    event.srcElement.style = 'color: transparent;';
    // document.getElement
    const targetId = event.srcElement.id.split('-')
    const targetUploadedImage = targetId[0] + '_uploadedImage'
    const targetContainer = targetId[0] + '_container_uploadedImage'

    const targetContainerNew = targetId[0] + '_container_upload'

    const newNode = document.createElement('div');
    newNode.id = targetContainer
    newNode.style = 'display:flex; flex-direction:column; width:fit-content;'

    const img = URL.createObjectURL(event.target.files[0]);

    newNode.innerHTML = \`<button id="remove-img-button" type="button" onclick="removeImage(\${targetContainer})">Remove</button><img id="\${targetUploadedImage}" width="200" src="\${img}"/></div>\`;

    if (document.getElementById(targetContainerNew)) {
      document.getElementById(targetContainerNew).appendChild(newNode)
    } else {
      const newContainerNode = document.createElement('div');
      newContainerNode.style = 'display:flex; flex-direction:column; gap: 15px; width:fit-content;'
      newContainerNode.id = targetContainerNew;

      event.srcElement.parentNode.appendChild(newContainerNode)
      document.getElementById(targetContainerNew).appendChild(newNode)
    }
  }
`).prependTo('head');

  const fName = $('input[id="firstname-input"]').val()
  const lName = $('input[id="lastname-input"]').val()
  const outputFilename = `${fName}_${lName}_${Date.now()}`
  console.log(outputFilename)

  const outputHtml = $.html();

  // fs.writeFileSync('file:///tmp/' + outputFilename + '.html', outputHtml);
  // fs.writeFileSync(outputFilename + '.html', outputHtml); // USED FOR LOCAL DEV

  // const browser2 = await chromium.puppeteer.launch({
  //   args: chromium.args,
  //   defaultViewport: chromium.defaultViewport,
  //   executablePath: await chromium.executablePath,
  //   headless: chromium.headless,
  //   ignoreHTTPSErrors: true
  // });
  // USED FOR LOCAL DEV
  // const browser2 = await puppeteer.launch({
  //   args: puppeteer.args,
  //   defaultViewport: puppeteer.defaultViewport,
  //   headless: true,
  //   ignoreHTTPSErrors: true
  // });
  // const page2 = await browser2.newPage();
  // await page2.setViewport({ width: 1000, height: 926 });
  // await page2.goto('file:///tmp/' + outputFilename + '.html',{waitUntil: 'networkidle0'});
  // await page2.goto('file:////Users/prash/Projects/sector/' + outputFilename + '.html',{waitUntil: 'networkidle0'}); // USED FOR LOCAL DEV

  // await page2.emulateMediaType('screen');
  // const pdf2 = await page2.pdf({
  //   path: './' + outputFilename + '.pdf',
  //   margin: { top: '50px', right: '20px', bottom: '50px', left: '20px' },
  //   printBackground: true,
  //   format: 'A4',
  // });
  // await page2.screenshot({ path: './' + outputFilename + '.png', fullPage: true });
  // browser2.close();

  const AWS = require('aws-sdk');

  const s3 = new AWS.S3({
    accessKeyId: 'AKIATXPVXTXDPVJVIZUJ',
    secretAccessKey: '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' // TODO: FIND A SOLUTION TO HIDE THIS
  });

  console.log('Starting file upload')

  const params = {
    Bucket: 'sector-inserter',
    Key: outputFilename + '.html',
    Body: outputHtml,
    ContentType: 'text/html'
  };
  const s3Upload = await s3.upload(params).promise()
  console.log(`File uploaded successfully at ${s3Upload.Location}`)
  const response = {
    uploadedUrl: s3Upload.Location
  }
  return {
    'statusCode': 200,
    'body': JSON.stringify(response)
  }
  // s3.upload(params, function (s3Err, data) {
  //   if (s3Err) throw s3Err
  //   console.log(`File uploaded successfully at ${data.Location}`)
  //     return {
  //       'statusCode': 200,
  //       'body': JSON.stringify(data.Location)
  //     }
  // });

  // fs.readFile(outputFilename + '.png', function (err, data) {
  //   if (err) { throw err; }
  //   params = {Bucket: 'sector-inserter', Key: outputFilename + '.png', Body: data };

  //   s3.upload(params, function(err, data) {
  //       if (err) {
  //         console.log(err)
  //       } else {
  //         console.log(`Successfully uploaded image at ${data.Location}`);
  //       }
  //   });
  // });
}

// main(); // USED FOR LOCAL DEV
