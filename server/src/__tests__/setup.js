const sequelize = require('../db');

// Register all models so Sequelize knows about them before sync
require('../models/User');
require('../models/Student');
require('../models/Interaction');
require('../models/Outcome');
require('../models/CourseProgress');
require('../models/LmsEngagement');
require('../models/StudentReflection');
require('../models/EmailTemplate');
require('../models/HexPosition');
require('../models/StudentGameStyle');
require('../models/AppSetting');
require('../models/FollowUp');

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});
