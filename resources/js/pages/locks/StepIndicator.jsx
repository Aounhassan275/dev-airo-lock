import { Box, InlineStack, Text, Icon } from '@shopify/polaris';
import { CheckIcon } from '@shopify/polaris-icons';
import React from 'react';

const StepIndicator = ({ currentStep, steps, onStepClick }) => {
    return (
        <Box paddingBlockEnd="600">
            <InlineStack gap="0" align="center" blockAlign="center">
                {steps.map((step, index) => {
                    const stepNumber = index + 1;
                    const isActive = stepNumber === currentStep;
                    const isCompleted = stepNumber < currentStep;
                    const isClickable = isCompleted && onStepClick;

                    return (
                        <React.Fragment key={step.key}>
                            {/* Step Circle */}
                            <div
                                onClick={() => isClickable && onStepClick(stepNumber)}
                                className={`
                                    flex items-center justify-center
                                    w-10 h-10 rounded-full
                                    transition-all duration-200
                                    ${isActive 
                                        ? 'bg-[#008060] text-white shadow-md' 
                                        : isCompleted 
                                            ? 'bg-[#008060] text-white cursor-pointer hover:shadow-md' 
                                            : 'bg-gray-200 text-gray-500'
                                    }
                                `}
                                style={{
                                    minWidth: '40px',
                                    minHeight: '40px',
                                }}
                            >
                                {isCompleted ? (
                                    <Icon source={CheckIcon} tone="inherit" />
                                ) : (
                                    <Text 
                                        variant="bodyMd" 
                                        fontWeight="semibold"
                                        as="span"
                                    >
                                        {stepNumber}
                                    </Text>
                                )}
                            </div>

                            {/* Step Label */}
                            <div className="ml-3 mr-6">
                                <Text
                                    variant="bodyMd"
                                    fontWeight={isActive ? 'semibold' : 'regular'}
                                    tone={isActive ? 'base' : 'subdued'}
                                    as="span"
                                >
                                    {step.label}
                                </Text>
                                {step.description && (
                                    <Text variant="bodySm" tone="subdued" as="p">
                                        {step.description}
                                    </Text>
                                )}
                            </div>

                            {/* Connector Line */}
                            {index < steps.length - 1 && (
                                <div
                                    className={`
                                        h-0.5 flex-1 min-w-[60px] max-w-[120px]
                                        transition-colors duration-200
                                        ${isCompleted ? 'bg-[#008060]' : 'bg-gray-200'}
                                    `}
                                />
                            )}
                        </React.Fragment>
                    );
                })}
            </InlineStack>
        </Box>
    );
};

export default StepIndicator;