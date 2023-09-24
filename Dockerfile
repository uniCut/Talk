# Use the official Node.js image as the base image
FROM node:18

# Set the working directory inside the container
WORKDIR /app

# Copy the package.json and package-lock.json files to the container
COPY package.json /app/package.json

# Install the dependencies
RUN npm install

# copy the source Code to the container
COPY . /app/

# Start the server when the container starts
CMD ["node", "app.js"]
