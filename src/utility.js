// Applies thousand separators to a number. The input should be an integer for intended functionality.
export function formatInteger(x) {
	return x.toLocaleString("en-US").replaceAll(",", " ");
}
// Rounds a decimal to `decimalPlaces` significant figures and applies thousand separators.
export function formatDecimal(x, decimalPlaces) {
	return (Math.round(x * 10 ** decimalPlaces) / 10 ** decimalPlaces).toLocaleString("en-US").replaceAll(",", " ");
}
// Returns `x` modulo `modulus`. Works for negative numbers unlike `x % modulus`.
export function modulo(x, modulus) {
	return x - modulus * Math.floor(x / modulus);
}
// Returns an array with the integers from 1 to x: for example, countTo(4) = [1,2,3,4]
export function countTo(x, from0 = false) {
	return Array(x).fill(0).map((x,i) => from0 ? i : (i + 1));
}
// Randomises the order of an array's elements.
export function shuffleArray(array) {
	let numbers = countTo(array.length,true);
	let out = [];
	while (numbers.length > 0) {
		out.push(array[numbers.splice(Math.floor(Math.random() * numbers.length), 1)]);
	}
	return out;
}
// Converts a polar position vector to a Cartesian one.
export function polarToCartesian(r, theta) {
	return [r * Math.cos(theta), r * Math.sin(theta)];
}
// Returns the square of the distance between two points given by position vectors.
export function squaredDistance(p, q) {
	return (p[0] - q[0]) * (p[0] - q[0]) + (p[1] - q[1]) * (p[1] - q[1]);
}
// Adds two or more vectors.
export function addVectors() {
	let out = [0, 0];
	for (let i = 0; i < arguments.length; i++) {
		out[0] += Number(arguments[i][0]);
		out[1] += Number(arguments[i][1]);
	}
	return out;
}
// Multiplies a vector by a scalar.
export function multiplyVectors(vector, scalar) {
	return [vector[0] * scalar, vector[1] * scalar];
}
const binomialCoefficients = [[1]];
// Retrieves a binomial coefficient, or if it has not been calculated yet, calculates it.
function calculateBinomialCoefficient(row, col) {
	if ((col < 0) || (col > row)) { // Treat all out of bounds coefficients as 0.
		return 0;
	}
	if (binomialCoefficients[row] === undefined) {
		binomialCoefficients[row] = [];
	}
	if (binomialCoefficients[row][col] === undefined) {
		binomialCoefficients[row][col] = calculateBinomialCoefficient(row - 1, col) + calculateBinomialCoefficient(row - 1, col - 1);
	}
	return binomialCoefficients[row][col];
}
export function bezierCurve(criticalPoints, t) {
	let terms = countTo(criticalPoints.length, true);
	return addVectors(...terms.map(i => multiplyVectors(criticalPoints[i], calculateBinomialCoefficient(terms.length - 1, i) * (1 - t) ** (terms.length - 1 - i) * t ** i)));
}
// Returns a random integer in a range.
export function ranint(min, max) {
	return Math.floor(min + (max + 1 - min) * Math.random());
}
// Returns a random real number in a range.
export function randomReal(min, max) {
	return min + (max - min) * Math.random();
}
// Creates a vector with random i and j components within a range.
export function randomCartesianVector(maxX, maxY = maxX) {
	return [maxX * (Math.random() * 2 - 1), maxY * (Math.random() * 2 - 1)];
}
// Creates a vector with a random speed in a range and in a random direction.
export function randomPolarVector(minR, maxR = minR, minTheta = 0, maxTheta = Math.PI * 2) {
	return polarToCartesian(randomReal(minR, maxR), randomReal(minTheta, maxTheta));
}
// Bounds a value within a defined range.
export function clampNumber(min, number, max) {
	return Math.max(min, Math.min(number, max));
}
// Bounds a vector within a defined square.
export function clampVector(vector, minX, maxX, minY, maxY) {
	return [Math.max(minX, Math.min(vector[0], maxX)), Math.max(minY, Math.min(vector[1], maxY))];
}
// Returns the difference between two angles, in radians, accounting for phase (e.g. the difference between pi and 4pi should be pi, not 3pi).
export function angleDifference(a1, a2) {
	let out = Math.abs(a1 - a2) % (Math.PI * 2);
	return Math.min(out, Math.PI * 2 - out);
}
// Rotates a vector `angle` radians anticlockwise.
export function rotateVector(vector, angle) {
	return [Math.cos(angle) * vector[0] - Math.sin(angle) * vector[1], Math.sin(angle) * vector[0] + Math.cos(angle) * vector[1]];
}
// Creates a layered linear gradient (i.e. a gradient with no smoothly changing regions, such as for a life bar).
// `colourArray` is an array of pairs of colours and ratios (e.g. [["#ffffff", 0.2], ["#ff0000", 0.7]]). Here `0.2` corresponds to "20%"
// Each percentage in `intermediatePoints` is the start of the next colour.
export function layeredLinearGradient(colourArray, angle = "90deg") {
	let out = "linear-gradient(" + angle;
	for (let pairNum = 0; pairNum < colourArray.length; pairNum++) {
		let nextEndPoint = (pairNum === (colourArray.length - 1)) ? "100%" : ((colourArray[pairNum + 1][1] * 100) + "%");
		out += ", " + colourArray[pairNum][0] + " " + (colourArray[pairNum][1] * 100) + "%, " + colourArray[pairNum][0] + " " + nextEndPoint;
	}
	out += ")";
	return out;
}
// Randomly returns either positive or negative 1.
export function plusMinus1() {
	return (Math.random() < 0.5) ? 1 : -1;
}
// Checks if a number is between two other numbers.
export function numberIsBounded(min, x, max) {
	return (min <= x) && (x <= max);
}
// Returns a random number between 0 and 1 from a seed. Borrowed from Ivar Kerajarvi's 'Antimatter Dimensions', with changed numbers due to use of integers.
export function predictableRandom(x) {
	let start = Math.pow(x % 97.20200719, 4.3) * 232344573;
	const a = 15485863 + x / 2.718281828;
	const b = 521791 + x / 3.141592653;
	start = (start * a) % b;
	for (let i = 0; i < (x * x) % 90 + 90; i++) {
		start = (start * a) % b;
	}
	return start / b;
}