module.exports = function (req, res, next) {
  // Assuming req.user is populated by the auth middleware
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Admins only.' });
  }
};
