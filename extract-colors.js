import getColors from 'get-image-colors';

getColors('../../Pictures/drilldown.jpeg').then(colors => {
  console.log('Dominant colors:');
  colors.forEach((color, index) => {
    console.log(`${index + 1}: ${color.hex()}`);
  });
}).catch(err => {
  console.error('Error:', err);
});