FROM node:8

RUN useradd user && mkdir -p /home/user && chown user /home/user
USER user
WORKDIR /home/user
ADD package.json package.json
RUN yarn install
ADD dl-livepeer.js dl-livepeer.js
RUN ./dl-livepeer.js
RUN ./livepeer -version