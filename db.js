const axios = require('axios');
const jwt = require('jsonwebtoken');
const Sequelize = require('sequelize');
const { STRING, INTEGER, UUID, UUIDV4 } = Sequelize;
const config = {
  logging: false
};

if(process.env.LOGGING){
  delete config.logging;
}
const conn = new Sequelize(process.env.DATABASE_URL || 'postgres://localhost/acme_db', config);

const User = conn.define('user', {
  id: {
    primaryKey: true,
    type: UUID,
    defaultValue: UUIDV4
  },
  username: STRING,
  githubId: INTEGER,
  avatar: STRING
});

User.byToken = async(token)=> {
  try {
    const { username } = await jwt.verify(token, process.env.JWT);
    const user = await User.findOne({where:{username}});
    if(user){
      return user;
    }
    throw 'noooo';
  }
  catch(ex){
    const error = Error('bad credentials');
    error.status = 401;
    throw error;
  }
};

// documentation - https://docs.github.com/en/developers/apps/authorizing-oauth-apps

// useful urls
const GITHUB_CODE_FOR_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_ACCESS_TOKEN_FOR_USER_URL = 'https://api.github.com/user';

//the authenticate methods is passed a code which has been sent by github
//if successful it will return a token which identifies a user in this app
User.authenticate = async(code, client_id, client_secret)=> {
  let response = await axios.post("https://github.com/login/oauth/access_token", {
    client_id,
    client_secret,
    code
  }, {headers: {
    accept: "application/json"
  }})

  response = await axios.get("https://api.github.com/user", {
    headers: {
      authorization: `token ${response.data.access_token}`
    }
  })

  console.log(response.data)
  const {login, id, avatar_url} = response.data
  let user = await User.findOne({
    where: {username: login}
  })

  if(!user){
    user = await User.create({
      username: login,
      githubId: id,
      avatar: avatar_url
    })
  }

  const jwtToken = jwt.sign({username: user.username}, process.env.JWT)
  return jwtToken
};

const syncAndSeed = async()=> {
  await conn.sync({ force: true });
};

module.exports = {
  syncAndSeed,
  models: {
    User
  }
};
