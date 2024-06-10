FROM node:20

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json package-lock.json ./

RUN npm i --frozen-lockfile

COPY . .

EXPOSE 8080

CMD [ "npm", "run", "watch" ]