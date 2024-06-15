Install instructions

git pull
create

Rename env.dist to .env

Import the database into postgres, and set the connection string in .env
Install neo4j 4.x.
Install APOC library for neo4j (this step may or may not be painful)
Import the neo4j database
Set neo4j parameters in .env

run
composer install

run
npm run dev

It should now be live and able to receive requests from POSTMAN

If changes arent live, you need to build ts manually, run
npm run build-ts
If that happens ideally the nodemon thing should be fixed