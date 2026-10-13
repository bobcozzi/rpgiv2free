        // Send Initialization String to Zebra Printer
     D ZebraInit       PR                  extProc('Zebra_Send_Printer_+
     D                                              Initialization_String')
     D  barCodeSrc                   20A   Const OPTIONS(*NOPASS)
     D  barCodeMbr                   10A   Const OPTIONS(*NOPASS)
