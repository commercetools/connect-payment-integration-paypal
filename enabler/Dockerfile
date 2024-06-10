FROM node:20

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json package-lock.json ./

RUN npm i --frozen-lockfile

COPY . .

EXPOSE 3000

CMD [ "npm", "run", "dev" ]