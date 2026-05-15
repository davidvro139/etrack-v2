const router = require('express').Router();
const { protect } = require('../middleware/auth');
const EmailTemplate = require('../models/EmailTemplate');

// GET /api/email-templates
router.get('/', protect, async (req, res, next) => {
  try {
    const templates = await EmailTemplate.findAll({ order: [['name', 'ASC']] });
    res.json(templates);
  } catch (err) { next(err); }
});

// POST /api/email-templates
router.post('/', protect, async (req, res, next) => {
  try {
    const { name, subject, body } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });
    const template = await EmailTemplate.create({ name, subject, body });
    res.status(201).json(template);
  } catch (err) { next(err); }
});

// PUT /api/email-templates/:id
router.put('/:id', protect, async (req, res, next) => {
  try {
    const template = await EmailTemplate.findByPk(req.params.id);
    if (!template) return res.status(404).json({ message: 'Template not found' });
    await template.update(req.body);
    res.json(template);
  } catch (err) { next(err); }
});

// DELETE /api/email-templates/:id
router.delete('/:id', protect, async (req, res, next) => {
  try {
    const template = await EmailTemplate.findByPk(req.params.id);
    if (!template) return res.status(404).json({ message: 'Template not found' });
    await template.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
