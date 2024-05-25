FROM node:18.16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install 

COPY . .

ENV PEER_PATH_NUMBER=0

EXPOSE 8080

CMD ["npm", "start"]