import { useState } from 'react'
import { Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { colors } from '../../theme/tokens'
import { CRS_OPTIONS } from '../../domain/reproject'

interface CrsPickerProps {
  onApply: (code: string) => void
}

/** Shown in place of the normal preview step when a parsed upload's coordinates don't look like valid lng/lat — most likely a missing/unrecognized .prj. */
export function CrsPicker({ onApply }: CrsPickerProps) {
  const [code, setCode] = useState(CRS_OPTIONS[0].code)

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="body2" color={colors.textPrimary}>
        Kein gültiges Koordinatensystem erkannt (.prj fehlt oder unbekannt).
      </Typography>
      <Typography variant="caption" color={colors.textSecondary}>
        Bitte das Koordinatensystem der Datei wählen, um sie korrekt auf der Karte zu platzieren.
      </Typography>
      <Stack direction="row" spacing={1.5} sx={{ mt: 1.5, alignItems: 'center' }}>
        <TextField select size="small" value={code} onChange={(e) => setCode(e.target.value)} sx={{ width: 260 }}>
          {CRS_OPTIONS.map((option) => (
            <MenuItem key={option.code} value={option.code}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        <Button variant="contained" onClick={() => onApply(code)}>
          Anwenden
        </Button>
      </Stack>
    </Box>
  )
}
