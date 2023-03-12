FROM amazon/aws-lambda-nodejs:16
COPY index.js package.json ./
# # Install Chrome to get all of the dependencies installed
# ADD https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm chrome.rpm
# RUN yum install -y ./chrome.rpm
RUN npm install
CMD [ "index.handler" ]
