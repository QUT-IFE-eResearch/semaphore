module.exports = function(rel) {
  rel.get('', function(req, res) {
    res.json({version : '0.2'});
  });
}