FROM node:26.12.1-alpine
WORKDIR /app
COPY . .
EXPOSE 8080
RUN npm install
CMD ["npm", "run", "start"]