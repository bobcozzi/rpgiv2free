         // Send Initialization String to Zebra Printer
         dcl-pr ZebraInit
           extProc('Zebra_Send_Printer_Initialization_String');
           barCodeSrc char(20) Const OPTIONS(*NOPASS);
           barCodeMbr char(10) Const OPTIONS(*NOPASS);
         end-pr ZebraInit;
