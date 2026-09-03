/** 附件二原始37条系统级需求；保留原文用于DFMEA快速填充。 */
window.DFMEA_SYSTEM_REQUIREMENTS = [
  [
    1,
    "Voltage",
    "Voltage Ripple – Peak to Peak\nThe HV ESS shall withstand a peak-to-peak voltage ripple on the HV DC bus, without functional de-rate or damage. The voltage ripple may be no greater than:"
  ],
  [
    2,
    "Safety",
    "McLaren High Voltage Safety Specification\nThe HV ESS shall comply with the McLaren High Voltage Safety specification."
  ],
  [
    3,
    "Contactors",
    "Main Contactors \nThe HV ESS shall provide suitably rated HV contactors/switches on both the positive and negative DC lines. The contactors shall be selected in combination with the main pack fuse to ensure that one or other device can isolate the pack from the external HV DC bus in all operational and fault current conditions. The HV contactors shall normally be open:"
  ],
  [
    4,
    "Contactors",
    "Main contactors total number of cycles \nMain contactors shall be capable of operating for the following total number of cycles:120,000 cycles"
  ],
  [
    5,
    "Contactors",
    "Contactor Power Supply \nThe HV ESS shall use only the 12V KL30C power supply from the vehicle to energise contactors."
  ],
  [
    6,
    "Over-current",
    "Over-Current: Cell-String HV DC Fuse \nThe HV ESS shall contain an appropriately rated fault current interruption device in series with the cell-string. The rating of the fuse shall be the supplier’s responsibility."
  ],
  [
    7,
    "Over-current",
    "Over-Current: Ancillary HV DC Fuses\nThe HV ESS shall incorporate an appropriately rated fault current interruption devices on ancillary HV DC links. The rating of fuses shall be supplier’s responsibility. Devices shall be serviceable without removing the main ESS cover."
  ],
  [
    8,
    "Over and under voltage",
    "Upper Voltage for Self-protection \nThe value of the upper voltage for self-protection is:450V"
  ],
  [
    9,
    "Over and under voltage",
    "Lower Voltage for Self-protection\nThe value of the lower voltage for self-protection is:240V"
  ],
  [
    10,
    "Isolation",
    "Isolation Design\nThe HV components within the HV ESS shall be isolated from the chassis in compliance with ISO6469-1:2019[10]. When tested in accordance with the procedure in this standard, the isolation resistance of the HV ESS alone shall be greater than the figure stated: 500 Ω/V"
  ],
  [
    11,
    "High Voltage Interlock",
    "HVIL: Design\nThe HVIL loop must travel from the ESS vehicle LV connector to BMU connector and then through the HV DC Link and the auxiliary DC link. The HVIL should have two pins (HVIL IN/ HVIL OUT)."
  ],
  [
    12,
    "Electric Shock Protection\n",
    "Finger-Proofing: fully assembled with connectors attached \nThe HV ESS shall be finger-proof, in the fully assembled state, with external connectors attached, and with the covers of the HV ESS attached, with the following rating:IPxxD"
  ],
  [
    13,
    "Electric Shock Protection\n",
    "Finger-Proofing: fully assembled without connectors attached\nThe HV ESS shall be finger-proof, in the fully assembled state, without external connectors attached, and with the covers of the HV ESS attached, with the following rating:IPxxB"
  ],
  [
    14,
    "Electric Shock Protection\n",
    "Equipotential Bonding\nAll conductive components not designed as HV conductors shall be equipotentially bonded to the vehicle chassis ground in compliance with the referenced standard:ISO6469-3:2011 [12], ECE R100 rev 5 [13]."
  ],
  [
    15,
    "Low Voltage",
    "12V Power Supply – Voltage range\nAll 12V components and harnesses must operate in the voltage range:9-16V"
  ],
  [
    16,
    "Low Voltage",
    "12V Power Supply – Current draw\nThe HV ESS shall receive it’s 12V power supply, except for the contactor coil power supply, from the vehicle via KL30 and be grounded via KL31. The HV ESS current draw from KL30 shall not exceed: 12A"
  ],
  [
    17,
    "Low Voltage",
    "12V Power Supply Performance\nWith regards to the performance under the defined operating scenarios the HV ESS electrical system shall comply with the requirements set out in the referenced specification."
  ],
  [
    18,
    "Low Voltage",
    "12V Power Supply – Power distribution\nAll LV components on the pack must be powered by the KL30 supply (apart from main contactors)."
  ],
  [
    19,
    "Service Requirements",
    "Serviceability –current interrupting devices\nIt shall be possible to service any current interrupting devices through an access panel."
  ],
  [
    20,
    "Low Voltage Interfaces",
    "Low Voltage Connector\nThe HV ESS shall provide an LV connection interface for all required low-voltage signal and power connections."
  ],
  [
    21,
    "Low Voltage Interfaces",
    "Connection to Chassis Ground\nThe HV ESS shall provide an electrically conductive connection to chassis ground, separate from the LV signal connector, for the purposes of equipotential bonding. The resistance between the components and chassis ground shall be less than the figure stated: 0.1 Ω"
  ],
  [
    22,
    "High Voltage Interfaces",
    "MCU HV Bus Connection Front\nThe HV ESS shall provide a high voltage connection to the front Motor Control Unit’s DC bus capable of withstanding the expected maximum current, temperature, and voltage conditions of the MCU bus. Additionally, such connections shall be compatible with the following wire CSA: TE CSJ1800 (wire CSA: 50 mm²)"
  ],
  [
    23,
    "High Voltage Interfaces",
    "MCU HV Bus Connection Rear\nThe HV ESS shall provide a high voltage connection to the rear Motor Control Unit’s DC bus capable of withstanding the expected maximum current, temperature, and voltage conditions of the MCU bus. Additionally, such connections shall be compatible with the following wire CSA: TE CSJ1800 (wire CSA 50 mm²)"
  ],
  [
    24,
    "High Voltage Interfaces",
    "Auxiliary HV Bus Connections\nThe HV ESS shall provide a high voltage DC connection to various HV ancillaries. Additionally, such connections shall be compatible with the following wire specifications: 4-pole connection (wire CSA: 4 and 6 mm²)"
  ],
  [
    25,
    "High Voltage Interfaces",
    "OBC HV Bus Connection\nThe HV ESS shall provide a high voltage DC connection to a DC charger capable of withstanding the power requirement. Additionally, such connections shall be compatible with the following wire specifications: TE HD400 – straight connection ( wire CSA: 6 mm²)"
  ],
  [
    26,
    "High Voltage Interfaces",
    "Serviceability\nThe HV connections shall not require any special tool to mate or un-mate the connection."
  ],
  [
    27,
    "High Voltage Interfaces",
    "Colour\nThe HV connectors shall be RAL 2001 orange colour. Any deviations must be approved by McLaren"
  ],
  [
    28,
    "High Voltage Interfaces",
    "Poka-Yoke\nThe connections shall incorporate a physical means of preventing mating of the two connection halves in the incorrect orientation or position."
  ],
  [
    29,
    "High Voltage Interfaces",
    "Ingress Protection – mated connections\nThe ingress protection rating of all connections to the vehicle in mated condition shall be:IP6K9"
  ],
  [
    30,
    "High Voltage Interfaces",
    "Finger-Proofing\nThe connections shall meet the following rating in both mated and unmated conditions:IPxxB"
  ],
  [
    31,
    "High Voltage Interfaces",
    "HVIL\nThe HV connections shall include two contacts for HVIL. The HVIL contact shall be made after the main power contacts and shall be mechanically enforced."
  ],
  [
    32,
    "Wiring harness requirements",
    "Temperature rise of Harness\nAll new/redesigned wiring harnesses must be able to meet the following standard: ISO19642-7 [53]: Class B"
  ],
  [
    33,
    "Wiring harness requirements",
    "Temperature rise of HV Harness – main DC path\nAll new/redesigned wiring harnesses must be able to meet the following standard: ISO19642-7 [53]: Class C"
  ],
  [
    34,
    "Wiring harness requirements",
    "HV Wiring Harness Colour\nAll HV wiring harnesses shall be the following orange colour: RAL 2001"
  ],
  [
    35,
    "Pre-charge",
    "Pre-Charge circuit consecutive cycles\nThe HV ESS shall contain a pre-charging circuit, including a pre-charge contactor and resistor. The pre-charge circuit shall be capable of repeated pre-charge cycles repeated continuously at the following time interval and total number of cycles: 2 sec 20 cycles"
  ],
  [
    36,
    "Pre-charge",
    "Pre-Charge circuit total number of cycles\nThe pre-charge circuit shall be capable of operating for the following total number of cycles: 120000"
  ],
  [
    37,
    "Pre-charge",
    "Pre-Charge Time\nThe pre-charging time, from the time that wake-up is received from the vehicle to the time that the ESS confirms to the vehicle that the main contactors are closed, shall not exceed:1.0 s"
  ]
];
