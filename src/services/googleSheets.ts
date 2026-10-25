import { RoundHistoryItem } from '../types';

export interface SheetFile {
  id: string;
  name: string;
  modifiedTime: string;
  webViewLink?: string;
}

export interface CreatedSheetInfo {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
  firstSheetName: string;
}

// List user spreadsheets from Google Drive
export const listUserSpreadsheets = async (token: string): Promise<SheetFile[]> => {
  const query = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime,webViewLink)&orderBy=modifiedTime desc&pageSize=15`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to list spreadsheets: ${err}`);
  }

  const data = await res.json();
  return data.files || [];
};

// Create a new Google Spreadsheet for Prediction Tracking
export const createPredictionSpreadsheet = async (
  token: string,
  title = 'Up or Down · BTC & SOL Prediction Journal'
): Promise<CreatedSheetInfo> => {
  const requestBody = {
    properties: {
      title,
    },
    sheets: [
      {
        properties: {
          title: 'Prediction History',
          gridProperties: {
            frozenRowCount: 1,
          },
        },
      },
    ],
  };

  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create spreadsheet: ${errText}`);
  }

  const sheetData = await createRes.json();
  const spreadsheetId: string = sheetData.spreadsheetId;
  const spreadsheetUrl: string = sheetData.spreadsheetUrl;
  const firstSheetName: string = sheetData.sheets?.[0]?.properties?.title || 'Prediction History';

  // Populate Header Row
  const headers = [
    'Timestamp (Epoch)',
    'Date & Time (UTC)',
    'Market',
    'Target Strike ($)',
    'Settled Price ($)',
    'Round Outcome',
    'AI Agent Call',
    'AI Probability',
    'Your Prediction',
    'Result',
    'Stake ($)',
    'Payout ($)',
    'Net P&L ($)',
  ];

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(
      firstSheetName
    )}'!A1:M1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: `'${firstSheetName}'!A1:M1`,
        majorDimension: 'ROWS',
        values: [headers],
      }),
    }
  );

  // Format Header Row (Dark styling, bold text, centered)
  const formatBody = {
    requests: [
      {
        repeatCell: {
          range: {
            sheetId: sheetData.sheets?.[0]?.properties?.sheetId || 0,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: headers.length,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.08, green: 0.08, blue: 0.1 },
              textFormat: {
                foregroundColor: { red: 0.95, green: 0.95, blue: 0.95 },
                bold: true,
                fontSize: 10,
              },
              horizontalAlignment: 'CENTER',
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
        },
      },
      {
        autoResizeDimensions: {
          dimensions: {
            sheetId: sheetData.sheets?.[0]?.properties?.sheetId || 0,
            dimension: 'COLUMNS',
            startIndex: 0,
            endIndex: headers.length,
          },
        },
      },
    ],
  };

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(formatBody),
  });

  return {
    spreadsheetId,
    spreadsheetUrl,
    title,
    firstSheetName,
  };
};

// Append rounds to the spreadsheet
export const appendRoundsToSheet = async (
  token: string,
  spreadsheetId: string,
  sheetName: string,
  marketId: string,
  rounds: RoundHistoryItem[]
): Promise<number> => {
  if (!rounds || rounds.length === 0) return 0;

  const rows = rounds.map((r) => {
    const date = new Date(r.s);
    const dateStr = date.toISOString().replace('T', ' ').slice(0, 19);
    const outcome = r.res.toUpperCase();
    const yourPick = r.u ? r.u.toUpperCase() : 'NO BET';
    const won = r.u ? (r.u === r.res ? 'WON' : 'LOST') : '–';
    const stake = r.stake || 10;
    const payout = r.u ? (r.u === r.res ? r.payout || stake * 1.9 : 0) : 0;
    const netPl = r.u ? payout - stake : 0;

    return [
      r.s,
      dateStr,
      marketId,
      r.tg.toFixed(2),
      r.f.toFixed(2),
      outcome,
      r.ag ? r.ag.toUpperCase() : '–',
      r.ap ? `${Math.round(r.ap * 100)}%` : '–',
      yourPick,
      won,
      r.u ? stake : 0,
      r.u ? payout.toFixed(2) : '0',
      r.u ? (netPl >= 0 ? `+${netPl.toFixed(2)}` : netPl.toFixed(2)) : '0',
    ];
  });

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(
      sheetName
    )}'!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        majorDimension: 'ROWS',
        values: rows,
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to append rows to Google Sheets: ${err}`);
  }

  const data = await res.json();
  return data.updates?.updatedRows || rows.length;
};
