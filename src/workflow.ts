// minimist helps reading command line arguments
import minimist from 'minimist';
import fs from 'fs';
import csv from 'csv-parser';
import { cloneDeep } from 'lodash';

interface Config {
  inputFileName: string;
  outputFileName: string;
  sorting: 'min' | 'max' | 'sum' | 'median';
}

interface Row {
  PRODUCT: string;
  PRICE: number;
  SALES: number;
  MONTH: 'Jan' | 'Feb' | 'Mar' | 'Apr' | 'May';
}

interface Earnings {
  name: string;
  min: number;
  max: number;
  sum: number;
  median: number;
}

export function workflow() {
  const argv = minimist(process.argv.slice(2));

  if (!argv.input) {
    console.log('--input=inputfilename is required');
    process.exit(-1);
  }

  if (!argv.output) {
    console.log('--output=outputfilename is required');
    process.exit(-1);
  }

  if (!argv.sorting || !['min', 'max', 'sum', 'median'].includes(argv.sorting)) {
    console.log('--sorting=min|max|sum|median is required');
    process.exit(-1);
  }

  const config: Config = {
    inputFileName: argv.input,
    outputFileName: argv.output,
    sorting: argv.sorting,
  };

  const csvResults: Row[] = [];
  fs.createReadStream(config.inputFileName)
    .pipe(csv())
    .on('data', (data: Row) => csvResults.push(data))
    .on('end', () => {
      transformData(config, csvResults);
    });
}

function transformData(config: Config, csvResults: Row[]) {
  console.table(csvResults);

  const grouped = new Map<string, Row[]>();
  for (let i = 0; i < csvResults.length; i++) {
    if (grouped.has(csvResults[i].PRODUCT)) {
      grouped.set(csvResults[i].PRODUCT, [...grouped.get(csvResults[i].PRODUCT)!, csvResults[i]]);
    } else {
      grouped.set(csvResults[i].PRODUCT, [csvResults[i]]);
    }
  }

  const earnings: Earnings[] = [];

  grouped.forEach((rows: Row[]) => {
    const name = rows[0].PRODUCT;

    let min = Number.MAX_SAFE_INTEGER;
    let max = 0;
    let sum = 0;
    let forMedian: number[] = [];

    rows.forEach((row: Row) => {
      const earning = row.PRICE * row.SALES;
      if (min > earning) {
        min = earning;
      }

      if (max < earning) {
        max = earning;
      }

      sum += earning;

      forMedian.push(earning);
    });

    const sortedMedianValues = forMedian.sort((a, b) => a - b);

    var half = Math.floor(sortedMedianValues.length / 2);

    const calculatedMedian =
      sortedMedianValues.length % 2
        ? sortedMedianValues[half]
        : (sortedMedianValues[half - 1] + sortedMedianValues[half]) / 2.0;

    earnings.push({ max, min, sum, median: calculatedMedian, name });
  });

  earnings.sort((a, b) => {
    if (config.sorting === 'max') {
      return a.max - b.max;
    } else if (config.sorting === 'min') {
      return a.min - b.min;
    } else if (config.sorting === 'median') {
      return a.median - b.median;
    } else {
      return a.sum - b.sum;
    }
  });

  console.table(earnings);

  fs.writeFileSync(config.outputFileName, JSON.stringify(earnings));
}
